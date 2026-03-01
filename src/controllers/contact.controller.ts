import { Request, Response } from 'express';

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
export const identify = (req: Request, res: Response): void => {
    const { email, phoneNumber } = req.body as IdentifyRequest;

    // Dummy response for now
    res.json({
        contact: {
            primaryContactId: 1,
            emails: email ? [email] : [],
            phoneNumbers: phoneNumber ? [String(phoneNumber)] : [],
            secondaryContactIds: []
        }
    });
};

