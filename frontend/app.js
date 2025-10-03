(function(){
  const state = {
    courses: [],
    currentCourse: null,
    currentModule: null,
    lessons: []
  };

  const qs = (s, el=document) => el.querySelector(s);
  const qsa = (s, el=document) => [...el.querySelectorAll(s)];

  // Theme
  const themeToggle = qs('#themeToggle');
  const root = document.documentElement;
  const savedTheme = localStorage.getItem('theme') || 'light';
  root.setAttribute('data-theme', savedTheme);
  themeToggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });

  // Views
  const homeView = qs('#homeView');
  const moduleView = qs('#moduleView');
  const backHome = qs('#backHome');
  backHome.addEventListener('click', (e)=>{ e.preventDefault(); showHome(); });

  function showHome(){
    moduleView.classList.remove('active');
    homeView.classList.add('active');
    loadCourses();
  }
  function showModule(){
    homeView.classList.remove('active');
    moduleView.classList.add('active');
  }

  // Dialogs
  const dlgCourse = qs('#dlgCourse');
  const formCourse = qs('#formCourse');
  const btnAddCourse = qs('#btnAddCourse');
  btnAddCourse.addEventListener('click', ()=> dlgCourse.showModal());
  formCourse.addEventListener('submit', async (e)=>{
    e.preventDefault();
  });
  formCourse.addEventListener('close', async ()=>{
    if (dlgCourse.returnValue === 'ok'){
      const fd = new FormData(formCourse);
      const payload = Object.fromEntries(fd.entries());
      if(!payload.title) return;
      const res = await fetch('/api/courses', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      if(res.ok){ await loadCourses(); formCourse.reset(); }
    }
  });

  const dlgModule = qs('#dlgModule');
  const formModule = qs('#formModule');
  formModule.addEventListener('close', async ()=>{
    if (dlgModule.returnValue === 'ok'){
      const fd = new FormData(formModule);
      const payload = Object.fromEntries(fd.entries());
      payload.lesson_count = parseInt(payload.lesson_count, 10);
      if(!payload.title || !state.currentCourse) return;
      const res = await fetch(`/api/courses/${state.currentCourse.id}/modules`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      if(res.ok){ await loadCourses(); formModule.reset(); openCourse(state.currentCourse.id); }
    }
  });

  // Search filter
  const searchInput = qs('#searchInput');
  searchInput.addEventListener('input', ()=>{
    renderSidebar();
    renderHomeCards();
  });

  // Sidebar tree
  async function loadCourses(){
    const res = await fetch('/api/courses');
    state.courses = await res.json();
    renderSidebar();
    renderHomeCards();
  }

  function renderSidebar(){
    const term = searchInput.value?.toLowerCase() || '';
    const el = qs('#courseTree');
    el.innerHTML = '';
    state.courses
      .filter(c => c.title.toLowerCase().includes(term) || c.modules_in_progress.some(m => m.title.toLowerCase().includes(term)))
      .forEach(course => {
      // Course row
      const courseDiv = document.createElement('div');
      courseDiv.className = 'course';

      const titleRow = document.createElement('div');
      titleRow.className = 'title-row';
      titleRow.innerHTML = `
        <div class="left">
          <div class="c-title"><strong>${escapeHTML(course.title)}</strong></div>
          <div class="meta">${course.watched_lessons}/${course.total_lessons} aulas · ${course.modules_completed}/${course.modules_count} módulos concluídos</div>
        </div>
        <div class="right">
          <button class="btn ghost" data-action="add-module">+ Módulo</button>
        </div>
      `;
      titleRow.addEventListener('click', (e)=>{
        if(e.target.closest('button')) return;
        openCourse(course.id);
      });
      courseDiv.appendChild(titleRow);

      // Modules in progress underneath
      const mods = document.createElement('div');
      course.modules_in_progress.forEach(m => {
        const row = document.createElement('div');
        row.className = 'module-row';
        row.innerHTML = `
          <div class="m-title" data-mid="${m.id}">${escapeHTML(m.title)}</div>
          <div class="m-sub">${m.watched_count}/${m.lesson_count} aulas</div>
          <div class="progress"><div class="progress-bar" style="width:${m.progress}%"></div></div>
        `;
        row.addEventListener('click', ()=> openModule(course.id, m.id, course.title, m.title));
        mods.appendChild(row);
      });
      courseDiv.appendChild(mods);

      // Add module button
      titleRow.querySelector('[data-action="add-module"]').addEventListener('click', (e)=>{
        e.stopPropagation();
        state.currentCourse = course;
        dlgModule.showModal();
      });

      el.appendChild(courseDiv);
    });
  }

  async function openCourse(courseId){
    const res = await fetch(`/api/courses/${courseId}`);
    const course = await res.json();
    state.currentCourse = course;
    // Expand in sidebar already shows modules in progress
    // Could also render all modules here if desired
  }

  async function openModule(courseId, moduleId, courseTitle, moduleTitle){
    state.currentModule = {id: moduleId, course_id: courseId, title: moduleTitle};
    qs('#crumbCourse').textContent = courseTitle || '';
    qs('#crumbModule').textContent = moduleTitle || '';

    const [modRes, lessonsRes, logsRes] = await Promise.all([
      fetch(`/api/modules/${moduleId}`),
      fetch(`/api/modules/${moduleId}/lessons`),
      fetch(`/api/modules/${moduleId}/logs?limit=20`)
    ]);
    const mod = await modRes.json();
    const lessons = await lessonsRes.json();
    const logs = await logsRes.json();
    state.lessons = lessons;

    // Header
    qs('#moduleTitle').textContent = mod.title;
    updateModuleHeader(mod);

    // Grid
    renderLessonGrid(lessons);

    // Logs
    renderLogs(logs);

    showModule();
  }

  function updateModuleHeader(mod){
    qs('#moduleStats').textContent = `${mod.watched_count}/${mod.lesson_count} aulas assistidas`;
    qs('#moduleProgress').style.width = `${mod.progress}%`;
  }

  function renderLessonGrid(lessons){
    const grid = qs('#lessonGrid');
    grid.innerHTML = '';
    // Choose a compact grid size close to square
    const cols = Math.min(12, Math.max(6, Math.ceil(Math.sqrt(lessons.length))));
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(36px, 1fr))`;

    lessons.forEach(l => {
      const tile = document.createElement('div');
      tile.className = 'tile' + (l.watched ? ' watched' : '');
      tile.textContent = l.number;
      tile.title = l.watched_at ? `Assistida em ${fmtDate(l.watched_at)}` : 'Não assistida';
      tile.dataset.id = l.id;
      tile.addEventListener('click', ()=> toggleLesson(tile, l.id));
      grid.appendChild(tile);
    });

    // Mark all / unmark all
    qs('#btnMarkAll').onclick = () => bulkMark(true);
    qs('#btnUnmarkAll').onclick = () => bulkMark(false);
  }

  async function bulkMark(value){
    // toggle only if needed to avoid extra logs
    const tiles = qsa('.tile');
    for (const tile of tiles){
      const watched = tile.classList.contains('watched');
      if (watched !== value){
        await toggleLesson(tile, tile.dataset.id, /*silent*/true);
      }
    }
  }

  async function toggleLesson(tile, lessonId, silent=false){
    const res = await fetch(`/api/lessons/${lessonId}/toggle`, {method:'POST'});
    if(!res.ok) return;
    const data = await res.json();
    const l = data.lesson;
    const mod = data.module;

    // update tile UI
    tile.classList.toggle('watched', l.watched);
    tile.title = l.watched_at ? `Assistida em ${fmtDate(l.watched_at)}` : 'Não assistida';

    // update header stats
    updateModuleHeader(mod);

    // add to logs (prepend)
    if(!silent){
      prependLog({lesson_id:l.id, action: l.watched ? 'watched' : 'unwatched', timestamp: l.watched_at || new Date().toISOString()});
      // small celebration when complete
      if(mod.progress === 100){
        toast('Módulo concluído! 🎉');
      }
    }

    // refresh sidebar & home summaries
    loadCourses();
  }

  function renderHomeCards(){
    const container = qs('#courseCards');
    const term = searchInput.value?.toLowerCase() || '';
    container.innerHTML = '';
    state.courses
      .filter(c => c.title.toLowerCase().includes(term) || c.modules_in_progress.some(m => m.title.toLowerCase().includes(term)))
      .forEach(c => {
        const card = document.createElement('div');
        card.className = 'card';

        const thumb = document.createElement('div');
        thumb.className = 'thumb';
        if (c.image_url){
          const img = document.createElement('img');
          img.src = c.image_url;
          img.alt = c.title;
          thumb.innerHTML = '';
          thumb.appendChild(img);
        } else {
          thumb.textContent = 'Sem capa';
        }

        const body = document.createElement('div');
        body.className = 'body';
        body.innerHTML = `
          <h3>${escapeHTML(c.title)}</h3>
          <div class="muted">${c.watched_lessons}/${c.total_lessons} aulas · ${c.modules_completed}/${c.modules_count} módulos concluídos</div>
          <div class="progress" style="margin-top:.5rem"><div class="progress-bar" style="width:${c.course_progress}%"></div></div>
          <div class="muted" style="margin-top:.35rem">${c.course_progress}% do curso</div>
        `;

        // Modules in progress as pills
        const modsWrap = document.createElement('div');
        modsWrap.style.marginTop = '.5rem';
        if (c.modules_in_progress.length){
          c.modules_in_progress.forEach(m => {
            const pill = document.createElement('div');
            pill.className = 'pill';
            pill.style.cursor = 'pointer';
            pill.innerHTML = `📁 ${escapeHTML(m.title)} · ${m.watched_count}/${m.lesson_count}`;
            pill.title = 'Abrir módulo';
            pill.addEventListener('click', ()=> openModule(c.id, m.id, c.title, m.title));
            modsWrap.appendChild(pill);
          });
        } else {
          const done = document.createElement('div');
          done.className = 'pill';
          done.textContent = 'Nenhum módulo em andamento';
          modsWrap.appendChild(done);
        }

        body.appendChild(modsWrap);
        card.appendChild(thumb);
        card.appendChild(body);
        container.appendChild(card);
      });
  }

  function renderLogs(logs){
    const ul = qs('#logList');
    ul.innerHTML = '';
    for(const log of logs){
      const li = document.createElement('li');
      li.textContent = `Aula #${log.lesson_id} → ${log.action === 'watched' ? 'assistida' : 'desmarcada'} em ${fmtDate(log.timestamp)}`;
      ul.appendChild(li);
    }
  }
  function prependLog(log){
    const ul = qs('#logList');
    const li = document.createElement('li');
    li.textContent = `Aula #${log.lesson_id} → ${log.action === 'watched' ? 'assistida' : 'desmarcada'} em ${fmtDate(log.timestamp)}`;
    ul.prepend(li);
    // cap at 50
    if(ul.children.length > 50) ul.removeChild(ul.lastChild);
  }

  function toast(msg){
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position:'fixed', bottom:'16px', right:'16px', padding:'10px 12px',
      border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)',
      borderRadius:'8px', zIndex:9999, boxShadow:'0 6px 18px rgba(0,0,0,.2)'
    });
    document.body.appendChild(t);
    setTimeout(()=> t.remove(), 2200);
  }

  function fmtDate(iso){
    try {
      return new Date(iso).toLocaleString();
    } catch(e){ return iso; }
  }
  function escapeHTML(str){
    return str.replace(/[&<>"']/g, (m)=> ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  }

  // Start
  loadCourses();
  showHome();
})();
