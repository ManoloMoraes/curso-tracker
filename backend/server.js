require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuração do PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'curso_tracker',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Inicialização do banco de dados
async function initDatabase() {
  try {
    // Criar tabela de logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) DEFAULT 'default_user',
        course_id VARCHAR(255) NOT NULL,
        module_id VARCHAR(255) NOT NULL,
        lesson_index INTEGER NOT NULL,
        action VARCHAR(50) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tabelas criadas com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar o banco de dados:', error);
  }
}

// Rotas
app.post('/api/logs', async (req, res) => {
  try {
    const { courseId, moduleId, lessonIndex, action } = req.body;
    
    const result = await pool.query(
      'INSERT INTO activity_logs (course_id, module_id, lesson_index, action) VALUES ($1, $2, $3, $4) RETURNING *',
      [courseId, moduleId, lessonIndex, action]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao salvar log:', error);
    res.status(500).json({ error: 'Erro ao salvar log de atividade' });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const { courseId, moduleId } = req.query;
    
    let query = 'SELECT * FROM activity_logs';
    const params = [];
    
    if (courseId && moduleId) {
      query += ' WHERE course_id = $1 AND module_id = $2';
      params.push(courseId, moduleId);
    } else if (courseId) {
      query += ' WHERE course_id = $1';
      params.push(courseId);
    }
    
    query += ' ORDER BY timestamp DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    res.status(500).json({ error: 'Erro ao buscar logs de atividade' });
  }
});

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  await initDatabase();
});