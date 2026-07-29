import mysql from 'mysql2/promise';
import fs from 'fs';

async function main() {
  const envContent = fs.readFileSync('.env', 'utf8');
  const getEnv = (key) => {
    const match = envContent.match(new RegExp(`${key}=(.*)`));
    return match ? match[1].trim() : null;
  };

  const url = getEnv('DATABASE_URL');
  const apiKey = getEnv('TRELLO_API_KEY');
  const token = getEnv('TRELLO_TOKEN');

  if (!url) {
    console.error("No DATABASE_URL found");
    return;
  }
  
  const connection = await mysql.createConnection(url);
  const [rows] = await connection.execute('SELECT memberIds FROM atis_cards WHERE isArchived = 0');
  
  const uniqueMemberIds = new Set();
  const memberCounts = {};

  for (const row of rows) {
    let ids = [];
    if (row.memberIds) {
      try {
        ids = JSON.parse(row.memberIds);
      } catch (e) {
        if (typeof row.memberIds === 'string') {
          ids = row.memberIds.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
    }
    if (Array.isArray(ids)) {
      for (const id of ids) {
        uniqueMemberIds.add(id);
        memberCounts[id] = (memberCounts[id] || 0) + 1;
      }
    }
  }

  console.log("Fetching names from Trello API...");
  const memberDetails = [];

  for (const id of uniqueMemberIds) {
    let name = "Unknown Member";
    let username = "unknown";
    
    if (apiKey && token) {
      try {
        const response = await fetch(`https://api.trello.com/1/members/${id}?key=${apiKey}&token=${token}`);
        if (response.ok) {
          const data = await response.json();
          name = data.fullName || name;
          username = data.username || username;
        }
      } catch (e) {
        console.warn(`Failed to fetch Trello name for ${id}`);
      }
    }
    memberDetails.push({ id, name, username, count: memberCounts[id] });
  }

  // Also query va_profiles to see who is already registered
  const [vaRows] = await connection.execute('SELECT id, name, email FROM va_profiles');

  console.log("\n==================================================");
  console.log("Trello Members Found in Database Cards (With Real Names):");
  console.log("==================================================");
  
  for (const m of memberDetails) {
    console.log(`- Name: ${m.name} (@${m.username})`);
    console.log(`  Trello ID: ${m.id}`);
    console.log(`  Cards Assigned in DB: ${m.count}`);
  }

  console.log("\n==================================================");
  console.log("VA Profiles Currently in DB:");
  console.log("==================================================");
  console.log(`Total registered VAs: ${vaRows.length}`);
  for (const va of vaRows) {
    console.log(`- VA ID: ${va.id} | Name: ${va.name} | Email: ${va.email}`);
  }
  console.log("==================================================\n");

  await connection.end();
}

main().catch(console.error);
