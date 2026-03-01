import app from './app';
import { startDatabasePing } from './config/database';

const PORT: number = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startDatabasePing();
});
