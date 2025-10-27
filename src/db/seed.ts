import { hashPassword } from '../utils/auth.js';
import { query } from './connection.js';

async function seed() {
  try {
    console.log('Starting database seeding...');

    // Create admin user
    const adminPassword = await hashPassword('admin123');
    await query(
      `INSERT INTO users (email, password_hash, full_name, global_status)
       VALUES ('admin@example.com', $1, 'Admin User', 'ADMIN')
       ON CONFLICT (email) DO NOTHING`,
      [adminPassword],
    );

    // Create test user
    const userPassword = await hashPassword('user123');
    await query(
      `INSERT INTO users (email, password_hash, full_name, global_status)
       VALUES ('user@example.com', $1, 'Test User', 'ACTIVE')
       ON CONFLICT (email) DO NOTHING`,
      [userPassword],
    );

    console.log('✅ Database seeding completed successfully');
    console.log('👤 Admin credentials: admin@example.com / admin123');
    console.log('👤 User credentials: user@example.com / user123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();



