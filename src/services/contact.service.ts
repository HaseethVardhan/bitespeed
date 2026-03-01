import { prisma } from '../config/database';
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

    //Find all contacts that have the same email OR phone number
    const matchedContacts = await prisma.contact.findMany({
        where: {
            OR: [
                ...(phoneNumber ? [{ phoneNumber }] : []),
                ...(email ? [{ email }] : [])
            ]
        }
    });

    //If no matching contacts found, create a new primary contact
    if (matchedContacts.length === 0) {
        const newContact = await prisma.contact.create({
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

        // Cache this new record (we know there are no other clusters involved)
        await setCachedResponse(email, phoneNumber, finalResponse, newContact.id);

        return finalResponse;
    }

    //Match found. Collect all unique related IDs to find the entire group of contacts
    const contactIds = new Set<number>();
    matchedContacts.forEach(contact => {
        contactIds.add(contact.id);
        if (contact.linkedId !== null) {
            //This is useful when a contact is linked to another contact from another cluster
            //Example: Contact A is linked to Contact B, and Contact B is linked to Contact C
            //If we find Contact A, we need to find Contact B and Contact C as well
            contactIds.add(contact.linkedId);
        }
    });

    const contactIdsArray = Array.from(contactIds);

    //Fetch the entire cluster of contacts
    const clusterContacts = await prisma.contact.findMany({
        where: {
            OR: [
                { id: { in: contactIdsArray } },
                { linkedId: { in: contactIdsArray } }
            ]
        }
    });

    //Determine the oldest contact to act as the true "primary"
    clusterContacts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const primaryContact = clusterContacts[0];

    //Demote any other primary contacts (or contacts linked to other primaries) to secondary
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
        await prisma.contact.updateMany({
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

    //Check if we need to create a new secondary contact (new information introduced)
    const hasNewEmail = email && !clusterContacts.some(c => c.email === email);
    const hasNewPhone = phoneNumber && !clusterContacts.some(c => c.phoneNumber === phoneNumber);
    const hasNewInfo = hasNewEmail || hasNewPhone;

    if (hasNewInfo) {
        const newSecondary = await prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkedId: primaryContact.id,
                linkPrecedence: 'secondary'
            }
        });
        clusterContacts.push(newSecondary);
    }

    //Construct the final response payload
    const emails = new Set<string>();
    const phoneNumbers = new Set<string>();
    const secondaryContactIds: number[] = [];

    //Ensure primary contact info is added first to preserve ordering
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

    // Before returning, optionally invalidate the cache if we mutated the cluster
    if (idsToUpdate.length > 0 || hasNewInfo) {
        await invalidateCluster(primaryContact.id);
    }

    // Finally, cache the newly generated response
    await setCachedResponse(email, phoneNumber, finalResponse, primaryContact.id);

    return finalResponse;
};
