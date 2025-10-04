// Modelo de dados
let courses = JSON.parse(localStorage.getItem('courses')) || [];

// Configuração da API
const API_URL = 'http://localhost:3000/api';

// Elementos DOM
const coursesList = document.getElementById('courses-list');
const ongoingCourses = document.getElementById('ongoing-courses');
const homeView = document.getElementById('home-view');
const courseView = document.getElementById('course-view');
const moduleView = document.getElementById('module-view');
const addCourseBtn = document.getElementById('add-course-btn');
const courseModal = document.getElementById('course-modal');
const moduleModal = document.getElementById('module-modal');
const courseForm = document.getElementById('course-form');
const moduleForm = document.getElementById('module-form');
const themeToggle = document.getElementById('theme-toggle');

// Variáveis de estado
let currentCourseId = null;
let currentModuleId = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    renderCoursesList();
    renderOngoingCourses();
    setupEventListeners();
    loadTheme();
});

// Configuração de event listeners
function setupEventListeners() {
    // Toggle do tema
    themeToggle.addEventListener('click', toggleTheme);
    
    // Adicionar curso
    addCourseBtn.addEventListener('click', () => {
        document.getElementById('modal-title').textContent = 'Adicionar Curso';
        document.getElementById('course-name').value = '';
        document.getElementById('course-image').value = '';
        courseForm.dataset.mode = 'add';
        courseModal.style.display = 'block';
    });
    
    // Fechar modais
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            courseModal.style.display = 'none';
            moduleModal.style.display = 'none';
        });
    });
    
    // Salvar curso
    courseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('course-name').value;
        const imageUrl = document.getElementById('course-image').value || 'https://via.placeholder.com/300x150?text=Curso';
        
        if (courseForm.dataset.mode === 'add') {
            addCourse(name, imageUrl);
        } else {
            updateCourse(currentCourseId, name, imageUrl);
        }
        
        courseModal.style.display = 'none';
    });
    
    // Salvar módulo
    moduleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('module-name').value;
        const lessonCount = parseInt(document.getElementById('lesson-count').value);
        
        if (moduleForm.dataset.mode === 'add') {
            addModule(currentCourseId, name, lessonCount);
        } else {
            updateModule(currentCourseId, currentModuleId, name, lessonCount);
        }
        
        moduleModal.style.display = 'none';
    });
    
    // Fechar modais ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target === courseModal) {
            courseModal.style.display = 'none';
        }
        if (e.target === moduleModal) {
            moduleModal.style.display = 'none';
        }
    });
}

// Funções de renderização
function renderCoursesList() {
    coursesList.innerHTML = '';
    
    courses.forEach(course => {
        const courseItem = document.createElement('li');
        courseItem.className = 'course-item';
        courseItem.innerHTML = `
            <div class="course-header">
                <span>${course.name}</span>
                <div>
                    <button class="add-module-btn" data-course-id="${course.id}">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="edit-course-btn" data-course-id="${course.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
            <ul class="course-modules" id="modules-${course.id}">
                ${course.modules.map(module => {
                    const completedLessons = module.lessons.filter(lesson => lesson.completed).length;
                    const progress = module.lessons.length > 0 
                        ? Math.round((completedLessons / module.lessons.length) * 100) 
                        : 0;
                    
                    return `
                        <li class="module-item" data-course-id="${course.id}" data-module-id="${module.id}">
                            <span>${module.name}</span>
                            <span class="module-progress">${completedLessons}/${module.lessons.length}</span>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progress}%"></div>
                            </div>
                        </li>
                    `;
                }).join('')}
            </ul>
        `;
        coursesList.appendChild(courseItem);
        
        // Event listeners para o curso
        const courseHeader = courseItem.querySelector('.course-header');
        courseHeader.addEventListener('click', () => {
            const modulesList = document.getElementById(`modules-${course.id}`);
            modulesList.classList.toggle('active');
        });
        
        // Event listener para adicionar módulo
        const addModuleBtn = courseItem.querySelector('.add-module-btn');
        addModuleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentCourseId = course.id;
            document.getElementById('module-modal-title').textContent = 'Adicionar Módulo';
            document.getElementById('module-name').value = '';
            document.getElementById('lesson-count').value = '';
            moduleForm.dataset.mode = 'add';
            moduleModal.style.display = 'block';
        });
        
        // Event listener para editar curso
        const editCourseBtn = courseItem.querySelector('.edit-course-btn');
        editCourseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentCourseId = course.id;
            document.getElementById('modal-title').textContent = 'Editar Curso';
            document.getElementById('course-name').value = course.name;
            document.getElementById('course-image').value = course.imageUrl;
            courseForm.dataset.mode = 'edit';
            courseModal.style.display = 'block';
        });
        
        // Event listeners para os módulos
        const moduleItems = courseItem.querySelectorAll('.module-item');
        moduleItems.forEach(moduleItem => {
            moduleItem.addEventListener('click', () => {
                const courseId = moduleItem.dataset.courseId;
                const moduleId = moduleItem.dataset.moduleId;
                showModuleView(courseId, moduleId);
            });
        });
    });
}

function renderOngoingCourses() {
    ongoingCourses.innerHTML = '';
    
    // Filtrar cursos com pelo menos um módulo iniciado
    const ongoing = courses.filter(course => {
        return course.modules.some(module => {
            return module.lessons.some(lesson => lesson.completed);
        });
    });
    
    if (ongoing.length === 0) {
        ongoingCourses.innerHTML = '<p>Nenhum curso em andamento. Comece a assistir aulas para ver seus cursos aqui.</p>';
        return;
    }
    
    ongoing.forEach(course => {
        const courseCard = document.createElement('div');
        courseCard.className = 'course-card';
        
        // Calcular progresso geral do curso
        const totalLessons = course.modules.reduce((total, module) => total + module.lessons.length, 0);
        const completedLessons = course.modules.reduce((total, module) => {
            return total + module.lessons.filter(lesson => lesson.completed).length;
        }, 0);
        
        const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
        
        courseCard.innerHTML = `
            <img src="${course.imageUrl}" alt="${course.name}" class="course-image">
            <div class="course-card-content">
                <h3 class="course-card-title">${course.name}</h3>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <p class="module-progress">${completedLessons}/${totalLessons} aulas concluídas (${progress}%)</p>
                <div class="module-cards">
                    ${course.modules.filter(module => {
                        return module.lessons.some(lesson => lesson.completed);
                    }).map(module => {
                        const moduleCompletedLessons = module.lessons.filter(lesson => lesson.completed).length;
                        const moduleProgress = module.lessons.length > 0 
                            ? Math.round((moduleCompletedLessons / module.lessons.length) * 100) 
                            : 0;
                        
                        return `
                            <div class="module-card" data-course-id="${course.id}" data-module-id="${module.id}">
                                <h4 class="module-card-title">${module.name}</h4>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${moduleProgress}%"></div>
                                </div>
                                <p class="module-progress">${moduleCompletedLessons}/${module.lessons.length}</p>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        
        ongoingCourses.appendChild(courseCard);
        
        // Event listeners para os módulos na home
        const moduleCards = courseCard.querySelectorAll('.module-card');
        moduleCards.forEach(moduleCard => {
            moduleCard.addEventListener('click', () => {
                const courseId = moduleCard.dataset.courseId;
                const moduleId = moduleCard.dataset.moduleId;
                showModuleView(courseId, moduleId);
            });
        });
    });
}

function showModuleView(courseId, moduleId) {
    currentCourseId = courseId;
    currentModuleId = moduleId;
    
    const course = courses.find(c => c.id === courseId);
    const module = course.modules.find(m => m.id === moduleId);
    
    // Esconder outras views e mostrar a view do módulo
    homeView.classList.remove('active');
    courseView.classList.remove('active');
    moduleView.classList.add('active');
    
    // Renderizar a view do módulo
    moduleView.innerHTML = `
        <div class="module-header">
            <h2>${course.name} > ${module.name}</h2>
            <button class="btn-primary back-to-home">Voltar</button>
        </div>
        <div class="lessons-grid">
            ${module.lessons.map((lesson, index) => {
                return `
                    <div class="lesson-item ${lesson.completed ? 'completed' : ''}" 
                         data-lesson-index="${index}">
                        ${index + 1}
                    </div>
                `;
            }).join('')}
        </div>
        <div class="lesson-details" id="lesson-details"></div>
    `;
    
    // Event listener para voltar à home
    const backBtn = moduleView.querySelector('.back-to-home');
    backBtn.addEventListener('click', () => {
        moduleView.classList.remove('active');
        homeView.classList.add('active');
    });
    
    // Event listeners para as aulas
    const lessonItems = moduleView.querySelectorAll('.lesson-item');
    lessonItems.forEach(lessonItem => {
        lessonItem.addEventListener('click', () => {
            const lessonIndex = parseInt(lessonItem.dataset.lessonIndex);
            toggleLessonCompletion(courseId, moduleId, lessonIndex);
            
            // Atualizar a aparência da aula
            lessonItem.classList.toggle('completed');
            
            // Mostrar detalhes da aula
            updateLessonDetails(courseId, moduleId, lessonIndex);
        });
    });
}

function updateLessonDetails(courseId, moduleId, lessonIndex) {
    const course = courses.find(c => c.id === courseId);
    const module = course.modules.find(m => m.id === moduleId);
    const lesson = module.lessons[lessonIndex];
    
    const lessonDetails = document.getElementById('lesson-details');
    
    if (lesson.completed) {
        const completedDate = new Date(lesson.completedAt);
        lessonDetails.innerHTML = `
            <h3>Aula ${lessonIndex + 1}</h3>
            <p>Status: <strong>Concluída</strong></p>
            <p class="lesson-log">Concluída em: ${completedDate.toLocaleString()}</p>
        `;
    } else {
        lessonDetails.innerHTML = `
            <h3>Aula ${lessonIndex + 1}</h3>
            <p>Status: <strong>Não concluída</strong></p>
        `;
    }
}

// Funções de manipulação de dados
function addCourse(name, imageUrl) {
    const newCourse = {
        id: generateId(),
        name,
        imageUrl,
        modules: []
    };
    
    courses.push(newCourse);
    saveCourses();
    renderCoursesList();
    renderOngoingCourses();
}

function updateCourse(courseId, name, imageUrl) {
    const course = courses.find(c => c.id === courseId);
    if (course) {
        course.name = name;
        course.imageUrl = imageUrl;
        saveCourses();
        renderCoursesList();
        renderOngoingCourses();
    }
}

function addModule(courseId, name, lessonCount) {
    const course = courses.find(c => c.id === courseId);
    if (course) {
        const lessons = Array(lessonCount).fill().map(() => ({
            completed: false,
            completedAt: null
        }));
        
        const newModule = {
            id: generateId(),
            name,
            lessons
        };
        
        course.modules.push(newModule);
        saveCourses();
        renderCoursesList();
        renderOngoingCourses();
    }
}

function updateModule(courseId, moduleId, name, lessonCount) {
    const course = courses.find(c => c.id === courseId);
    if (course) {
        const module = course.modules.find(m => m.id === moduleId);
        if (module) {
            module.name = name;
            
            // Ajustar o número de aulas
            const currentLessonCount = module.lessons.length;
            if (lessonCount > currentLessonCount) {
                // Adicionar novas aulas
                const newLessons = Array(lessonCount - currentLessonCount).fill().map(() => ({
                    completed: false,
                    completedAt: null
                }));
                module.lessons = [...module.lessons, ...newLessons];
            } else if (lessonCount < currentLessonCount) {
                // Remover aulas excedentes
                module.lessons = module.lessons.slice(0, lessonCount);
            }
            
            saveCourses();
            renderCoursesList();
            renderOngoingCourses();
        }
    }
}

function toggleLessonCompletion(courseId, moduleId, lessonIndex) {
    const course = courses.find(c => c.id === courseId);
    if (course) {
        const module = course.modules.find(m => m.id === moduleId);
        if (module && module.lessons[lessonIndex]) {
            const lesson = module.lessons[lessonIndex];
            lesson.completed = !lesson.completed;
            lesson.completedAt = lesson.completed ? new Date().toISOString() : null;
            
            // Salvar localmente
            saveCourses();
            
            // Enviar log para o backend PostgreSQL
            if (lesson.completed) {
                sendActivityLog(courseId, moduleId, lessonIndex, 'completed');
            } else {
                sendActivityLog(courseId, moduleId, lessonIndex, 'uncompleted');
            }
            
            renderCoursesList();
            renderOngoingCourses();
        }
    }
}

// Função para enviar logs de atividade para o backend
async function sendActivityLog(courseId, moduleId, lessonIndex, action) {
    try {
        const response = await fetch(`${API_URL}/logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                courseId,
                moduleId,
                lessonIndex,
                action
            })
        });
        
        if (!response.ok) {
            throw new Error('Falha ao enviar log para o servidor');
        }
        
        console.log('Log de atividade enviado com sucesso');
    } catch (error) {
        console.error('Erro ao enviar log:', error);
        // Continuar mesmo se falhar o envio para o servidor
        // Os dados ainda estão salvos localmente
    }
}

// Funções de utilidade
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function saveCourses() {
    localStorage.setItem('courses', JSON.stringify(courses));
}

function loadTheme() {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
        document.body.classList.add('dark-mode');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.body.classList.remove('dark-mode');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

function toggleTheme() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    
    if (isDarkMode) {
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
}