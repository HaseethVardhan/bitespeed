import { Request, Response, NextFunction } from 'express';

// Interface for identify request body
interface IdentifyRequest {
    email?: string;
    phoneNumber?: number;
}

/**
 * Validates email format using regex
 * @param email - The email string to validate
 * @returns boolean indicating if email is valid
 */
const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validates phone number
 * @param phoneNumber - The phone number to validate
 * @returns boolean indicating if phone number is valid
 */
const isValidPhoneNumber = (phoneNumber: number): boolean => {
    // Convert to string and check if it contains only digits
    const phoneStr = String(phoneNumber);
    return /^\d+$/.test(phoneStr) && phoneStr.length >= 5 && phoneStr.length <= 15;
};

/**
 * Middleware to validate identify request body
 * Validates that at least email or phoneNumber is provided
 * and that both are in valid format
 */
export const validateIdentify = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const { email, phoneNumber } = req.body as IdentifyRequest;

    // Check if at least one of email or phoneNumber is provided
    if (email === undefined && phoneNumber === undefined) {
        res.status(400).json({
            error: 'Validation Error',
            message: 'At least one of email or phoneNumber must be provided'
        });
        return;
    }

    // Validate email if provided
    if (email !== undefined) {
        if (typeof email !== 'string') {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Email must be a string'
            });
            return;
        }

        if (email.trim() === '') {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Email cannot be empty'
            });
            return;
        }

        if (!isValidEmail(email)) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Invalid email format'
            });
            return;
        }
    }

    // Validate phoneNumber if provided
    if (phoneNumber !== undefined) {
        if (typeof phoneNumber !== 'number') {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Phone number must be a number'
            });
            return;
        }

        if (!isValidPhoneNumber(phoneNumber)) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Invalid phone number format. Must be between 5-15 digits'
            });
            return;
        }
    }

    // If all validations pass, proceed to the next middleware/controller
    next();
};
