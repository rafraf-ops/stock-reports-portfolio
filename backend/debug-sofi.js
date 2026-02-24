import axios from 'axios';

async function debugSoFi() {
  try {
    // Get SoFi's CIK
    const tickersRes = await axios.get('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const sofi = Object.values(tickersRes.data).find(c => c.ticker === 'SOFI');
    console.log('SoFi CIK:', sofi.cik_str);
    
    const cik = String(sofi.cik_str).padStart(10, '0');
    console.log('Padded CIK:', cik);
    
    // Get company facts
    const factsUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
    console.log('Fetching:', factsUrl);
    
    const factsRes = await axios.get(factsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const data = factsRes.data;
    
    console.log('\n=== Available Fact Categories ===');
    console.log(Object.keys(data.facts || {}));
    
    if (data.facts && data.facts['us-gaap']) {
      console.log('\n=== Sample US-GAAP Fields ===');
      const fields = Object.keys(data.facts['us-gaap']).slice(0, 20);
      console.log(fields);
      
      // Check for revenue
      const revenueFields = Object.keys(data.facts['us-gaap']).filter(k => 
        k.toLowerCase().includes('revenue')
      );
      console.log('\n=== Revenue-related fields ===');
      console.log(revenueFields);
      
      // Check first revenue field
      if (revenueFields.length > 0) {
        const firstRevField = revenueFields[0];
        console.log(`\n=== ${firstRevField} ===`);
        const revData = data.facts['us-gaap'][firstRevField];
        console.log('Units available:', Object.keys(revData.units || {}));
        
        if (revData.units?.USD) {
          console.log('Number of USD entries:', revData.units.USD.length);
          console.log('Latest entry:', revData.units.USD[revData.units.USD.length - 1]);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugSoFi();