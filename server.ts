import express, { Request, Response } from 'express';

const app = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);

app.get('/', (req: Request, res: Response) => {
    res.send('Hello Bitespeed!');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
