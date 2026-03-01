import { prisma } from '../config/database';
import { Contact } from '@prisma/client';

interface CreateContactInput {
    phoneNumber?: string;
    email?: string;
    linkedId?: number;
    linkPrecedence: 'primary' | 'secondary';
}

interface CheckContactInput {
    phoneNumber?: string;
    email?: string;
}

export const createContact = async (input: CreateContactInput): Promise<Contact> => {
    return prisma.contact.create({
        data: input
    });
};

/**
 * Checks if a contact exists with the given phoneNumber or email
 * @param input - Object containing phoneNumber and/or email
 * @returns The existing contact if found, null otherwise
 */
export const findExistingContact = async (input: CheckContactInput): Promise<Contact | null> => {
    const { phoneNumber, email } = input;

    if (!phoneNumber && !email) {
        return null;
    }

    const contact = await prisma.contact.findFirst({
        where: {
            OR: [
                ...(phoneNumber ? [{ phoneNumber }] : []),
                ...(email ? [{ email }] : [])
            ]
        }
    });

    return contact;
};
