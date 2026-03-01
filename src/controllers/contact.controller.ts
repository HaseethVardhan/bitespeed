import { Request, Response } from 'express';
import { createContact } from '../services/contact.service';

// Interface for identify request body
interface IdentifyRequest {
    email?: string;
    phoneNumber?: number;
}

// health check endpoint to make sure server is running
export const healthCheck = (req: Request, res: Response): void => {
    res.json({
        message: "Hello Bitespeed! I'm healthy",
        timestamp: new Date().toISOString(),
        status: 'ok'
    });
};

// Identify endpoint to handle contact identification
export const identify = async (req: Request, res: Response): Promise<void> => {
    const { email, phoneNumber } = req.body as IdentifyRequest;

    // Create a new primary contact with the provided input
    const contact = await createContact({
        email,
        phoneNumber: phoneNumber ? String(phoneNumber) : undefined,
        linkPrecedence: 'primary'
    });

    res.json({
        contact: {
            primaryContactId: contact.id,
            emails: email ? [email] : [],
            phoneNumbers: phoneNumber ? [String(phoneNumber)] : [],
            secondaryContactIds: []
        }
    });
};

