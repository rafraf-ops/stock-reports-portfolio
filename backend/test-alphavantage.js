import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testAlphaVantage() {
  const API_KEY = process.env.ALPHA_VANTAGE_KEY;
  
  console.log('Testing Alpha Vantage...');
  console.log('API Key:', API_KEY);
  
  try {
    const url = 'https://www.alphavantage.co/query';
    const response = await axios.get(url, {
      params: {
        function: 'INCOME_STATEMENT',
        symbol: 'AAPL',
        apikey: API_KEY
      }
    });
    
    console.log('Response type:', typeof response.data);
    console.log('Response keys:', Object.keys(response.data));
    console.log('Full response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAlphaVantage();