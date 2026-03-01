import { prisma } from '../config/database';
import { Contact } from '@prisma/client';

interface CreateContactInput {
    phoneNumber?: string;
    email?: string;
    linkedId?: number;
    linkPrecedence: 'primary' | 'secondary';
}

export const createContact = async (input: CreateContactInput): Promise<Contact> => {
    return prisma.contact.create({
        data: input
    });
};
