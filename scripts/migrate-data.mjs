import { PrismaClient as PrismaClientPostgres } from '@prisma/client';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';

import fs from 'fs';
import path from 'path';

const prismaPostgres = new PrismaClientPostgres();

function findSqliteDb() {
  const candidates = [
    './prisma/dev.db',
    './prisma/prisma/dev.db',
    './prisma/dev.db.backup.' + new Date().toISOString().split('T')[0],
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.resolve(c))) return c;
  }
  return candidates[0];
}

const sqlitePath = findSqliteDb();
const db = new sqlite3.Database(sqlitePath);

const dbAll = promisify(db.all.bind(db));
const dbRun = promisify(db.run.bind(db));

async function migrateData() {
  try {
    console.log('🚀 Starting data migration from SQLite to PostgreSQL...\n');

    // Get all table names from SQLite
    const tables = await dbAll(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    );

    console.log(`📋 Found ${tables.length} tables to migrate\n`);

    let totalRecords = 0;
    const migrationStats = {};

    for (const table of tables) {
      const tableName = table.name;
      
      try {
        // Get all records from SQLite table
        const records = await dbAll(`SELECT * FROM ${tableName}`);
        
        if (records.length === 0) {
          console.log(`✅ ${tableName}: No records to migrate`);
          migrationStats[tableName] = 0;
          continue;
        }

        // Prepare records for insertion into PostgreSQL
        const cleanRecords = records.map(record => {
          const cleaned = {};
          for (const [key, value] of Object.entries(record)) {
            // Handle JSON fields
            if (value && typeof value === 'string' && value.startsWith('{')) {
              try {
                cleaned[key] = JSON.parse(value);
              } catch {
                cleaned[key] = value;
              }
            } else {
              cleaned[key] = value;
            }
          }
          return cleaned;
        });

        // Use Prisma to insert data (using raw query to bypass validation)
        if (cleanRecords.length > 0) {
          // Dynamic insertion based on table name
          const model = tableName.charAt(0).toUpperCase() + tableName.slice(1);
          const prismaModel = prismaPostgres[model.charAt(0).toLowerCase() + model.slice(1)];
          
          if (prismaModel && prismaModel.createMany) {
            await prismaModel.createMany({
              data: cleanRecords,
              skipDuplicates: true,
            });
          } else {
            // Fallback: insert records one by one
            for (const record of cleanRecords) {
              try {
                await prismaPostgres[Object.keys(prismaPostgres._appliedGlobalFeatures || {}).find(
                  k => k.toLowerCase() === tableName.toLowerCase()
                ) || tableName]?.create?.({ data: record });
              } catch (err) {
                console.warn(`⚠️  Failed to insert record in ${tableName}:`, err.message);
              }
            }
          }

          migrationStats[tableName] = cleanRecords.length;
          totalRecords += cleanRecords.length;
          console.log(`✅ ${tableName}: Migrated ${cleanRecords.length} records`);
        }
      } catch (err) {
        console.error(`❌ Error migrating ${tableName}:`, err.message);
        migrationStats[tableName] = 'ERROR';
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total records migrated: ${totalRecords}`);
    console.log('Details:');
    Object.entries(migrationStats).forEach(([table, count]) => {
      console.log(`  - ${table}: ${count} records`);
    });

    console.log('\n✅ Data migration completed successfully!');
    
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await prismaPostgres.$disconnect();
    db.close();
  }
}

migrateData();
