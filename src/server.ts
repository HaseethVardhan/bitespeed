import app from './app';
import { startDatabasePing } from './config/database';
import { connectRedis } from './config/redis';

const PORT: number = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startDatabasePing();
    await connectRedis();
});
