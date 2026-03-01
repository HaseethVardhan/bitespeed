import { Request, Response } from 'express';

// health check endpoint to make sure server is running
export const healthCheck = (req: Request, res: Response): void => {
    res.json({
        message: "Hello Bitespeed! I'm healthy",
        timestamp: new Date().toISOString(),
        status: 'ok'
    });
};

