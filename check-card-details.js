import mysql from 'mysql2/promise';
import fs from 'fs';

async function main() {
  const envContent = fs.readFileSync('.env', 'utf8');
  const match = envContent.match(/DATABASE_URL=(.*)/);
  const url = match[1].trim();
  const connection = await mysql.createConnection(url);

  const ids = [
    '63fc71419c1bee0bc1114ba1',
    '673c90631edfcde8551f69a2',
    '67e5ca392e52013c53693858',
    '63fc6f2500c510a166f3837e'
  ];

  for (const id of ids) {
    const cardId = id.split(':')[0];
    const [card] = await connection.execute('SELECT * FROM atis_cards WHERE trelloId = ?', [cardId]);
    console.log(`Card ${cardId}:`, card);
  }

  await connection.end();
}

main().catch(console.error);
