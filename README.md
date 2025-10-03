# Curso Tracker (self-hosted, via Coolify)

Um app **clean e minimalista** para você organizar seus cursos, módulos e aulas — com barra de progresso gamificada, um grid ao estilo **Campo Minado** para marcar as aulas assistidas e **log com data/hora** de cada marcação.

> **Stack:** FastAPI (Python) + SQLite (persistência) + HTML/CSS/JS vanilla (frontend).  
> **Implantação:** Dockerfile + `docker-compose.yml` (funciona perfeitamente no Coolify).

---

## Recursos principais

- **Menu lateral** (estilo ChatGPT / Explorador do Windows): lista seus **Cursos** e expande para ver **Módulos**.
- **Adicionar** cursos e módulos (com a **quantidade de aulas**).
- Em cada módulo, um **grid “Campo Minado”** mostra cada aula como um bloco:
  - **Cinza** = não assistida; **Verde** = assistida.
  - Clique para alternar; ao marcar como assistida, é gravado **log com data/hora**.
- **Homepage** com cards dos **cursos em andamento** (mostra apenas os **módulos iniciados**).
- Cada card exibe **progresso total do curso** e **chips dos módulos em andamento**.  
  Quando você finalizar todas as aulas de um módulo, **ele some da homepage** (fica apenas refletido no progresso do curso).
- **Barra de progresso** elegante e minimalista em módulo/curso.
- **Tema claro/escuro** (toggle no rodapé da sidebar).
- **API docs** embutida: `/docs`.

---

## Como rodar com Docker Compose (localmente ou no Coolify)

### 1) Baixe este pacote

Se você não clonou via Git, você pode subir os arquivos em um repositório seu **ou** carregar/colar no Coolify como **Docker Compose**.

Estrutura de pastas:
```
.
├── app/
│   └── main.py
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

### 2) (Opção A) Usando Docker Compose local

```bash
docker compose up -d --build
# Depois, acesse http://localhost:8080
```

> O banco `SQLite` fica em um volume Docker (`curso_tracker_data`).

### 3) (Opção B) Implantando no Coolify

1. **Nova Aplicação** → escolha **Dockerfile** *ou* **Docker Compose**.
2. Se escolher **Dockerfile**:
   - Conecte seu repositório Git com esses arquivos.
   - Configure **Porta de Exposição:** `8080`.
   - Adicione um **Volume** mapeando `/app/data` (persistência do SQLite).
   - (Opcional) `TZ=America/Sao_Paulo` como variável de ambiente.
3. Se escolher **Docker Compose**:
   - Cole o conteúdo do `docker-compose.yml`.
   - Defina **domínio/porta** na interface do Coolify.
4. **Deploy**. A UI estará disponível na URL configurada.

---

## Como usar

- Clique em **+ Novo curso** (rodapé da sidebar).  
- Em seguida, dentro do curso, clique em **+ Módulo** e informe **título** + **quantidade de aulas**.
- Clique em um **módulo** para abrir a visão principal e usar o **grid Campo Minado** para marcar/desmarcar aulas.
- Veja o **histórico recente** de marcações com data/hora no final da página do módulo.
- A **homepage** mostra os **módulos em andamento** e o **progresso total** de cada curso.  
  Módulos 100% concluídos somem da lista de “em andamento”.

---

## API (resumo)

- `GET /api/courses` → lista cursos com resumo + módulos em andamento.
- `POST /api/courses` → cria curso `{title, image_url?}`.
- `GET /api/courses/{id}` → resumo completo de um curso.
- `POST /api/courses/{id}/modules` → cria módulo `{title, lesson_count}` e gera as aulas.
- `GET /api/modules/{id}` → detalhe do módulo (progresso).
- `GET /api/modules/{id}/lessons` → aulas do módulo (com `watched`, `watched_at`).
- `POST /api/lessons/{id}/toggle` → alterna estado (grava **log** com timestamp).
- `GET /api/modules/{id}/logs` → últimos logs do módulo.
- `GET /api/lessons/{id}/logs` → logs de uma aula.

> Acesse **/docs** para explorar a API (Swagger).

---

## Observações

- O app cria alguns **dados de exemplo** na primeira execução.
- Todos os horários são gravados em **UTC** no backend e exibidos no **fuso local** do seu navegador.
- A marcação em massa (“Marcar tudo / Desmarcar tudo”) evita chamadas desnecessárias, mas faz várias requisições sequenciais para garantir o log por aula.

---

## Roadmap de ideias (opcional)

- Upload de **capa** direto no app (hoje é por URL).
- **Autenticação** e perfis (se for multiusuário).
- Exportação do **log** (CSV).
- Notas e links por aula/módulo.
- Análises simples: velocidade média, previsão de término do curso, etc.

---

MIT © Você 😉
