const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { google } = require('googleapis');
require('dotenv').config();
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// 구글 API 인증 설정
const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// 기본 주소 접속 시 index.html 화면 보여주기
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ★ [추가됨] 구글 시트에서 데이터를 읽어오는 기능 ★
app.get('/api/ledger', async (req, res) => {
    try {
        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: '시트1!A:H', // 시트의 A열부터 H열까지 가져옵니다.
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return res.status(200).json([]);
        }

        // 첫 번째 줄(제목)을 제외하고, 최신 날짜가 맨 위로 오도록 역순(reverse) 정렬하여 보냅니다.
        const data = rows.slice(1).reverse();
        res.status(200).json(data);
    } catch (error) {
        console.error('데이터 불러오기 중 오류 발생:', error);
        res.status(500).json({ message: '데이터를 불러오는데 실패했습니다.' });
    }
});

// 화면에서 입력받은 데이터를 구글 시트로 보내는 기능
app.post('/api/ledger', async (req, res) => {
    try {
        const { date, type, amount, category, subCategory, description, creditCard } = req.body;
        const yearMonth = date.substring(0, 7); 

        const sheets = google.sheets({ version: 'v4', auth });

        const newRow = [
            date, type, amount, category, subCategory, description, creditCard, yearMonth
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: '시트1!A:H',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [newRow],
            },
        });

        res.status(200).json({ message: '성공적으로 저장되었습니다!' });
    } catch (error) {
        console.error('시트 저장 중 오류 발생:', error);
        res.status(500).json({ message: '저장에 실패했습니다.' });
    }
});

// 서버 실행
app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});