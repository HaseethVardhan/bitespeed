import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';
import { getCachedResponse, setCachedResponse, invalidateCluster } from './cache.service';

interface CheckContactInput {
    phoneNumber?: string;
    email?: string;
}

export interface IdentifyResponse {
    contact: {
        primaryContactId: number;
        emails: string[];
        phoneNumbers: string[];
        secondaryContactIds: number[];
    };
}

export const identifyContact = async (input: CheckContactInput): Promise<IdentifyResponse> => {
    const { phoneNumber, email } = input;

    //Check if the input is valid
    if (!phoneNumber && !email) {
        throw new Error("Either email or phoneNumber must be provided");
    }

    // 1. Check if we have a cached response for this exact input
    const cachedResponse = await getCachedResponse(email, phoneNumber);
    if (cachedResponse) {
        console.log(`Cache HIT for map ${email}-${phoneNumber}`);
        return cachedResponse;
    }

    console.log(`Cache MISS for map ${email}-${phoneNumber}`);

    // Retry loop for Serializable transaction conflicts
    let remainingRetries = 3;
    while (remainingRetries > 0) {
        try {
            const result = await prisma.$transaction(async (tx) => {
                // Find all contacts that have the same email OR phone number
                // including their entire cluster in a single query by fetching relationships
                const matchedContacts = await tx.contact.findMany({
                    where: {
                        OR: [
                            ...(phoneNumber ? [{ phoneNumber }] : []),
                            ...(email ? [{ email }] : [])
                        ]
                    },
                    include: {
                        linkedContact: {
                            include: { linkedContacts: true }
                        },
                        linkedContacts: true
                    }
                });

                // If no matching contacts found, create a new primary contact
                if (matchedContacts.length === 0) {
                    const newContact = await tx.contact.create({
                        data: {
                            email,
                            phoneNumber,
                            linkPrecedence: 'primary'
                        }
                    });

                    const finalResponse = {
                        contact: {
                            primaryContactId: newContact.id,
                            emails: newContact.email ? [newContact.email] : [],
                            phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
                            secondaryContactIds: []
                        }
                    };

                    return { finalResponse, mutatedId: newContact.id, shouldInvalidate: false, fromEmpty: true };
                }

                // Match found. Collect all unique contacts in the cluster from nested includes
                const allContactsMap = new Map<number, any>();

                matchedContacts.forEach(match => {
                    allContactsMap.set(match.id, match);
                    if (match.linkedContact) {
                        allContactsMap.set(match.linkedContact.id, match.linkedContact);
                        if (match.linkedContact.linkedContacts) {
                            match.linkedContact.linkedContacts.forEach((sec: any) => {
                                allContactsMap.set(sec.id, sec);
                            });
                        }
                    }
                    if (match.linkedContacts) {
                        match.linkedContacts.forEach((sec: any) => {
                            allContactsMap.set(sec.id, sec);
                        });
                    }
                });

                const clusterContacts = Array.from(allContactsMap.values());

                // Determine the oldest contact to act as the true "primary"
                clusterContacts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
                const primaryContact = clusterContacts[0];

                // Demote any other primary contacts (or contacts linked to other primaries) to secondary
                const idsToUpdate: number[] = [];
                clusterContacts.forEach(contact => {
                    if (contact.id !== primaryContact.id && (contact.linkPrecedence === 'primary' || contact.linkedId !== primaryContact.id)) {
                        idsToUpdate.push(contact.id);
                        // Updating local array state for later processing without refetching
                        contact.linkPrecedence = 'secondary';
                        contact.linkedId = primaryContact.id;
                    }
                });

                if (idsToUpdate.length > 0) {
                    await tx.contact.updateMany({
                        where: {
                            id: { in: idsToUpdate }
                        },
                        data: {
                            linkPrecedence: 'secondary',
                            linkedId: primaryContact.id,
                            updatedAt: new Date()
                        }
                    });
                }

                // Check if we need to create a new secondary contact (new information introduced)
                const hasNewEmail = email && !clusterContacts.some(c => c.email === email);
                const hasNewPhone = phoneNumber && !clusterContacts.some(c => c.phoneNumber === phoneNumber);
                const hasNewInfo = hasNewEmail || hasNewPhone;

                if (hasNewInfo) {
                    const newSecondary = await tx.contact.create({
                        data: {
                            email,
                            phoneNumber,
                            linkedId: primaryContact.id,
                            linkPrecedence: 'secondary'
                        }
                    });
                    clusterContacts.push(newSecondary);
                }

                // Construct the final response payload
                const emails = new Set<string>();
                const phoneNumbers = new Set<string>();
                const secondaryContactIds: number[] = [];

                // Ensure primary contact info is added first to preserve ordering
                if (primaryContact.email) emails.add(primaryContact.email);
                if (primaryContact.phoneNumber) phoneNumbers.add(primaryContact.phoneNumber);

                clusterContacts.forEach(contact => {
                    if (contact.id !== primaryContact.id) {
                        secondaryContactIds.push(contact.id);
                    }
                    if (contact.email) emails.add(contact.email);
                    if (contact.phoneNumber) phoneNumbers.add(contact.phoneNumber);
                });

                const finalResponse = {
                    contact: {
                        primaryContactId: primaryContact.id,
                        emails: Array.from(emails),
                        phoneNumbers: Array.from(phoneNumbers),
                        secondaryContactIds
                    }
                };

                return { finalResponse, mutatedId: primaryContact.id, shouldInvalidate: idsToUpdate.length > 0 || hasNewInfo, fromEmpty: false };
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
                maxWait: 5000,
                timeout: 10000
            });

            // Cache invalidate/set out of transaction scope
            if (result.shouldInvalidate) {
                await invalidateCluster(result.mutatedId);
            }

            // Finally, cache the newly generated response
            await setCachedResponse(email, phoneNumber, result.finalResponse, result.mutatedId);

            return result.finalResponse;

        } catch (error: any) {
            // Prisma error code for Write Conflict / Deadlock under Serializable isolation
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
                remainingRetries--;
                if (remainingRetries === 0) {
                    throw new Error("Failed to process contact due to concurrent modifications.");
                }
                console.log(`Transaction serialization failure (P2034). Retrying... (${remainingRetries} attempts left)`);
                // Wait briefly before retrying (exponential backoff or simple jitter)
                await new Promise(res => setTimeout(res, 50 + Math.random() * 50));
                continue;
            }
            throw error; // Rethrow any other error
        }
    }
    throw new Error("Unexpected error in identifyContact");
};
