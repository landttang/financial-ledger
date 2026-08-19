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

// 기본 주소 접속
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. 데이터 읽어오기 (몇 번째 줄인지 '행 번호'도 같이 가져옵니다)
app.get('/api/ledger', async (req, res) => {
    try {
        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: '시트1!A:H', 
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return res.status(200).json([]);

        // 행 번호(rowNum)를 포함하여 최근 순으로 보냅니다.
        const dataWithIndex = rows.map((row, index) => ({ rowNum: index + 1, rowData: row }))
                                  .slice(1) // 첫 줄(제목) 제외
                                  .filter(item => item.rowData.length > 0 && item.rowData[0] !== '') // 빈 줄 제외
                                  .reverse();
        res.status(200).json(dataWithIndex);
    } catch (error) {
        console.error('불러오기 오류:', error);
        res.status(500).json({ message: '데이터 불러오기 실패' });
    }
});

// 2. 새로운 데이터 저장하기 (쓰기)
app.post('/api/ledger', async (req, res) => {
    try {
        const { date, type, amount, category, subCategory, description, creditCard } = req.body;
        const yearMonth = date.substring(0, 7); 
        const sheets = google.sheets({ version: 'v4', auth });
        const newRow = [date, type, amount, category, subCategory, description, creditCard, yearMonth];

        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: '시트1!A:H',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [newRow] },
        });

        res.status(200).json({ message: '저장 완료!' });
    } catch (error) {
        console.error('저장 오류:', error);
        res.status(500).json({ message: '저장 실패' });
    }
});

// ★ 3. [추가] 기존 데이터 수정하기 (업데이트) ★
app.put('/api/ledger/:rowNum', async (req, res) => {
    try {
        const rowNum = req.params.rowNum;
        const { date, type, amount, category, subCategory, description, creditCard } = req.body;
        const yearMonth = date.substring(0, 7); 
        const sheets = google.sheets({ version: 'v4', auth });
        const updatedRow = [date, type, amount, category, subCategory, description, creditCard, yearMonth];

        // 특정 행(rowNum)에 덮어쓰기
        await sheets.spreadsheets.values.update({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: `시트1!A${rowNum}:H${rowNum}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [updatedRow] },
        });

        res.status(200).json({ message: '수정 완료!' });
    } catch (error) {
        console.error('수정 오류:', error);
        res.status(500).json({ message: '수정 실패' });
    }
});

// ★ 4. [추가] 기존 데이터 삭제하기 ★
app.delete('/api/ledger/:rowNum', async (req, res) => {
    try {
        const rowNum = parseInt(req.params.rowNum);
        const sheets = google.sheets({ version: 'v4', auth });
        
        // 탭(시트1)의 고유 ID를 찾아서 해당 줄을 완전히 삭제합니다.
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: process.env.SPREADSHEET_ID });
        const sheet = sheetInfo.data.sheets.find(s => s.properties.title === '시트1');
        const sheetId = sheet.properties.sheetId;

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: process.env.SPREADSHEET_ID,
            requestBody: {
                requests: [{
                    deleteDimension: {
                        range: { sheetId: sheetId, dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum }
                    }
                }]
            }
        });

        res.status(200).json({ message: '삭제 완료!' });
    } catch (error) {
        console.error('삭제 오류:', error);
        res.status(500).json({ message: '삭제 실패' });
    }
});

app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});