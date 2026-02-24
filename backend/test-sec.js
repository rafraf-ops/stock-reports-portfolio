import axios from 'axios';

async function testSEC() {
  try {
    console.log('Testing SEC API...');
    
    const response = await axios.get('https://www.sec.gov/files/company_tickers.json', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const data = response.data;
    
    // Find PLTR
    const pltr = Object.values(data).find(c => c.ticker === 'PLTR');
    console.log('PLTR data:', pltr);
    
    if (pltr) {
      console.log('✓ SEC API is working!');
      console.log('CIK:', pltr.cik_str);
      console.log('Name:', pltr.title);
    } else {
      console.log('✗ PLTR not found in SEC');
    }
    
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

testSEC();