const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Логируем всё, что происходит
console.log("Текущая папка сервера:", __dirname);
console.log("Файлы в этой папке:", fs.readdirSync(__dirname));

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        res.status(404).send(`Ошибка: Файл index.html не найден! Я искал тут: ${htmlPath}. В папке сейчас лежат: ${fs.readdirSync(__dirname)}`);
    }
});

app.get('/test', (req, res) => res.send('Сервер видит эту страницу!'));

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Работаем на порту ${PORT}`));
