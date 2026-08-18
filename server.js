const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// 구글 API 인증 설정
const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// 기본 접속 테스트
app.get('/', (req, res) => {
    res.send('가계부 서버가 정상적으로 실행 중입니다!');
});

// ★ 화면에서 입력받은 데이터를 구글 시트로 보내는 핵심 기능 ★
app.post('/api/ledger', async (req, res) => {
    try {
        // 1. 화면(HTML)에서 사용자가 입력한 7가지 데이터 받아오기
        const { date, type, amount, category, subCategory, description, creditCard } = req.body;

        // 2. '년월' 자동 생성 (예: '2026-08-18' -> '2026-08')
        const yearMonth = date.substring(0, 7); 

        const sheets = google.sheets({ version: 'v4', auth });

        // 3. 구글 시트에 들어갈 A열부터 H열까지의 데이터 배열 만들기
        const newRow = [
            date,           // A: 날짜
            type,           // B: 유형
            amount,         // C: 금액
            category,       // D: 카테고리
            subCategory,    // E: 서브카테고리
            description,    // F: 설명
            creditCard,     // G: 신용카드
            yearMonth       // H: 년월 (서버가 자동으로 만든 값!)
        ];

        // 4. 구글 시트에 기록하라고 명령하기
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: '시트1!A:H', // 주의: 구글 시트 하단의 탭 이름이 '시트1'이어야 합니다. (영문이면 Sheet1)
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