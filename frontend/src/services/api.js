import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000";

export async function analyzeStock(ticker) {
  const response = await axios.get(`${API_BASE_URL}/analyze/${ticker}`);
  return response.data;
}

export async function getTrending() {
  const response = await axios.get(`${API_BASE_URL}/api/trending`);
  return response.data;
}