'use strict';

const STATE_VERSION = 3;
const STORAGE_KEY = 'setechub_state_v1';
const LEGACY_STORAGE_KEY = 'setec-hub-v2';
const THEME_KEY = 'setechub_theme';
const PRIVACY_KEY = 'setechub_privacy';
const SESSION_KEY = 'setechub_session';
const SUPABASE_CONFIG_KEY = 'setechub_supabase_config';
const GENERATED_SCHOOL_DATA = typeof window !== 'undefined' && window.SETECHUB_SCHOOL_DATA
  ? window.SETECHUB_SCHOOL_DATA
  : { generalAssets: [], schoolImports: [], schoolAssets: [], schoolNetworks: [] };

function uid() {
  return Date.now() + Math.floor(Math.random() * 10000);
}

function repairMojibakeString(value) {
  const text = String(value ?? '');
  if (!/[ÃÂâ€]/.test(text)) return text;
  try {
    const repaired = decodeURIComponent(escape(text));
    return repaired.includes('\uFFFD') ? text : repaired;
  } catch {
    return text;
  }
}

function deepRepairStrings(value) {
  if (Array.isArray(value)) return value.map((item) => deepRepairStrings(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepRepairStrings(item)]));
  }
  return typeof value === 'string' ? repairMojibakeString(value) : value;
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function mergeUniqueBy(baseItems, savedItems, keyFn) {
  const map = new Map();
  baseItems.forEach((item) => map.set(keyFn(item), item));
  savedItems.forEach((item) => map.set(keyFn(item), item));
  return Array.from(map.values());
}

function inferImportReviewStatus(item) {
  if (item?.reviewStatus) return item.reviewStatus;
  const id = String(item?.id || '');
  return id.startsWith('seed-') ? 'pending' : 'approved';
}

const SCHOOL_ALIASES = {
  'AGROVILA I': 'PEI EE Idalicio Mendes Lima'
};

function canonicalSchoolName(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const direct = SCHOOL_ALIASES[text.toUpperCase()];
  if (direct) return direct;
  const normalized = normalizeKey(text);
  const aliasEntry = Object.entries(SCHOOL_ALIASES).find(([alias]) => normalizeKey(alias) === normalized);
  return aliasEntry ? aliasEntry[1] : text;
}

const SCHOOL_MASTER = [
  { name: 'PEI EE Idalicio Mendes Lima', cie: '905227', zone: 'Itapeva', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true },
  { name: 'EE Doutor Antonio Deffune', cie: '49323', zone: 'Itapeva', status: 'critico', notes: 'Prioridade de suporte para conectividade e laboratorio.', fixedName: true },
  { name: 'PEI EE Professora Celia Vasques Ferrari Duch', cie: '39731', zone: 'Taquarivai', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true },
  { name: 'PEI EE Professora Cinira Daniel da Silva', cie: '35348', zone: 'Itapeva', status: 'atencao', notes: 'Fila tecnica acompanhada pela base do SEINTEC.', fixedName: true },
  { name: 'EE Bairro Ferreira dos Matos', cie: '915087', zone: 'Ribeirao Grande', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true },
  { name: 'PEI EE Professora Francelina Franco', cie: '15568', zone: 'Buri', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true },
  { name: 'EE Professor Gerson de Barros Margarido', cie: '43412', zone: 'Itapeva', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true },
  { name: 'EE Bairro Boa Vista Intervales', cie: '915075', zone: 'Ribeirao Grande', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true },
  { name: 'PEI EE Jeminiano David Muzel', cie: '15477', zone: 'Itapeva', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true },
  { name: 'PEI EE Professor Joao Baptista do Amaral Vasconcellos', cie: '910077', zone: 'Capao Bonito', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true },
  { name: 'PEI EE Professor Jose Vasques Ferrari', cie: '15519', zone: 'Itapeva', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true },
  { name: 'PEI EE Professora Nicota Soares', cie: '15489', zone: 'Itapeva', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true },
  { name: 'PEI EE Oscar Kurtz Camargo', cie: '15076', zone: 'Ribeirao Grande', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true },
  { name: 'PEI EE Otavio Ferrari', cie: '15404', zone: 'Itapeva', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true },
  { name: 'PEI EE Padre Arlindo Vieira', cie: '15118', zone: 'Capao Bonito', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true },
  { name: 'EE Doutor Raul Venturelli', cie: '15222', zone: 'Capao Bonito', status: 'atencao', notes: 'Monitorar infraestrutura e fila tecnica local.', fixedName: true },
  { name: 'PEI EE Ricardo Campolim de Almeida Neto', cie: '915117', zone: 'Nova Campina', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true },
  { name: 'EE Professor Silverio Monteiro', cie: '35336', zone: 'Itapeva', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true },
  { name: 'PEI EE Simpliciano Campolim de Almeida', cie: '15428', zone: 'Nova Campina', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true },
  { name: 'EE Bairro Turvo dos Almeidas', cie: '926036', zone: 'Capao Bonito', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true },
  { name: 'PEI EE Professora Zulmira de Oliveira', cie: '15544', zone: 'Itapeva', status: 'estavel', notes: 'Unidade oficial da URE Itapeva.', fixedName: true }
];

function mergeSchools(baseSchools, savedSchools) {
  const baseMap = new Map(baseSchools.map((item) => [normalizeKey(item.name), item]));
  const merged = [];
  savedSchools.forEach((item) => {
    const canonicalName = canonicalSchoolName(item.name);
    const key = normalizeKey(canonicalName);
    if (baseMap.has(key)) {
      const official = baseMap.get(key);
      merged.push({
        ...item,
        name: official.name,
        cie: item.cie || official.cie || '',
        zone: item.zone || official.zone,
        notes: item.notes || official.notes,
        fixedName: true
      });
      baseMap.delete(key);
      return;
    }
    merged.push(item);
  });
  return [...merged, ...Array.from(baseMap.values())];
}

function defaultSchoolProfiles(schools) {
  return schools.map((school) => ({
    id: `profile-${normalizeKey(school.name)}`,
    school: school.name,
    municipality: school.zone,
    director: '',
    viceDirector: '',
    proati: '',
    goe: '',
    phone: '',
    mobile: '',
    email: '',
    address: '',
    notes: ''
  }));
}

function defaultSupervisors(schools) {
  const supervisorContacts = [
    { name: 'Daiane Aparecida de Oliveira Ribeiro', email: 'daiane.ribeiro@educacao.sp.gov.br', phone: '(15) 3526-6227' },
    { name: 'Edilene da Silva Almeida Oliveira', email: 'edilene.oliveira@educacao.sp.gov.br', phone: '(15) 3526-6217' },
    { name: 'Magda Gisele Silva de Oliveira', email: 'magda.oliveira@educacao.sp.gov.br', phone: '(15) 3526-6232' },
    { name: 'Marcio Nunes da Cruz', email: 'marcio.cruz@educacao.sp.gov.br', phone: '(15) 3526-6208' },
    { name: 'Maria Luiza Brizolla de Queiroz', email: 'maria.queiroz14@educacao.sp.gov.br', phone: '(15) 3526-6216' },
    { name: 'Adilson Fogaca', email: 'adilson.fogaca@educacao.sp.gov.br', phone: '(15) 3526-6224' }
  ];
  return supervisorContacts.map((supervisor, index) => ({
    id: `sup-${index + 1}`,
    ...supervisor,
    schools: schools
      .filter((_, schoolIndex) => schoolIndex % supervisorContacts.length === index)
      .map((school) => school.name),
    monthlyGoal: Math.max(1, schools.filter((_, schoolIndex) => schoolIndex % supervisorContacts.length === index).length),
    source: 'teste'
  }));
}

function defaultSupervisorVisits(supervisors) {
  const currentYear = new Date().getFullYear();
  return supervisors.flatMap((supervisor, supervisorIndex) =>
    supervisor.schools.slice(0, 3).map((school, schoolIndex) => ({
      id: `visit-${supervisorIndex + 1}-${schoolIndex + 1}`,
      supervisor: supervisor.name,
      school,
      date: `${currentYear}-${String((schoolIndex + supervisorIndex) % 12 + 1).padStart(2, '0')}-${String(8 + schoolIndex * 6).padStart(2, '0')}`,
      type: schoolIndex % 2 === 0 ? 'Rotina' : 'Acompanhamento',
      notes: 'Registro de teste para validar o BI de supervisao.'
    }))
  );
}

function defaultUsers(supervisors) {
  const supervisorUsers = supervisors.map((supervisor, index) => ({
    id: `user-supervisor-${index + 1}`,
    name: supervisor.name,
    login: supervisor.name,
    pin: '1234',
    role: 'supervisor',
    supervisorName: supervisor.name,
    active: true
  }));
  return [
    {
      id: 'user-admin-jefferson',
      name: 'Jefferson',
      login: 'Jefferson',
      pin: '1234',
      role: 'admin',
      active: true
    },
    {
      id: 'user-dirigente',
      name: 'Andre',
      login: 'Andre',
      pin: '1234',
      role: 'dirigente',
      active: true
    },
    {
      id: 'user-seintec',
      name: 'Elcio',
      login: 'Elcio',
      pin: '1234',
      role: 'seintec',
      active: true
    },
    {
      id: 'user-ctc',
      name: 'Gustavo',
      login: 'Gustavo',
      pin: '1234',
      role: 'ctc',
      active: true
    },
    ...supervisorUsers
  ];
}

function normalizeDefaultUserNames(users) {
  const replacements = {
    dirigente: { name: 'Andre', login: 'Andre' },
    seintec: { name: 'Elcio', login: 'Elcio' },
    ctc: { name: 'Gustavo', login: 'Gustavo' }
  };
  return (users || []).map((user) => {
    const replacement = replacements[user.role];
    if (!replacement) return user;
    const oldGeneric = ['dirigente', 'seintec', 'ctc'].includes(normalizeKey(user.name)) ||
      ['dirigente', 'seintec', 'ctc'].includes(normalizeKey(user.login));
    return oldGeneric ? { ...user, ...replacement } : user;
  });
}

function loadSupabaseConfig() {
  try {
    return JSON.parse(localStorage.getItem(SUPABASE_CONFIG_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveSupabaseConfig(config) {
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config || {}));
}

function createDefaults() {
  const schools = SCHOOL_MASTER.map((school) => ({ id: uid(), ...school }));
  const supervisors = defaultSupervisors(schools);
  return {
    stateVersion: STATE_VERSION,
    lastUpdatedAt: new Date().toISOString(),
    profile: {
      name: 'Jefferson',
      unit: 'URE Itapeva',
      pin: '1234'
    },
    users: defaultUsers(supervisors),
    officialContacts: {
      office: 'Unidade Regional de Ensino de Itapeva - URE | Rua Torquato Raimundo, 96 - Jardim Ferrari - Itapeva/SP | Tel. (15) 3526-6200 | deitv@educacao.sp.gov.br',
      officeName: 'Unidade Regional de Ensino de Itapeva - URE',
      address: 'Rua Torquato Raimundo, 96 - Jardim Ferrari - Itapeva/SP',
      phone: '(15) 3526-6200',
      email: 'deitv@educacao.sp.gov.br',
      dirigente: 'Andre Dias de Oliveira',
      since: '23/05/2025'
    },
    municipalities: [
      { id: uid(), name: 'Itapeva', schoolCount: 11, notes: 'Maior concentracao de unidades da regional.' },
      { id: uid(), name: 'Capao Bonito', schoolCount: 4, notes: 'Polo importante na circunscricao da URE.' },
      { id: uid(), name: 'Ribeirao Grande', schoolCount: 3, notes: 'Base com unidades em bairros e area de Intervales.' },
      { id: uid(), name: 'Nova Campina', schoolCount: 2, notes: 'Municipio com duas unidades PEI oficiais.' },
      { id: uid(), name: 'Buri', schoolCount: 1, notes: 'Unidade oficial Francelina Franco.' },
      { id: uid(), name: 'Taquarivai', schoolCount: 1, notes: 'Unidade oficial Celia Vasques Ferrari Duch.' }
    ],
    sectors: [
      {
        id: uid(),
        code: 'DIRETORIA',
        name: 'Dirigencia Regional de Ensino',
        lead: 'Andre Dias de Oliveira',
        phone: '(15) 3526-6200',
        email: 'deitv@educacao.sp.gov.br',
        summary: 'Gestao geral da regional e articulacao das diretrizes educacionais.'
      },
      {
        id: uid(),
        code: 'SEINTEC',
        name: 'Servico de Informacoes Educacionais e Tecnologia',
        lead: 'Elcio Renato Bonifacio de Azevedo',
        phone: '(15) 3526-6211',
        email: 'itv.seintec@educacao.sp.gov.br',
        summary: 'Atendimento tecnico, portais, chamados, suporte de tecnologia e monitoramento das escolas.'
      },
      {
        id: uid(),
        code: 'SETEC',
        name: 'Secao de Tecnologia',
        lead: 'Jefferson do Espirito Santo Moreira',
        phone: '(15) 3526-6235',
        email: 'deitvnit@educacao.sp.gov.br',
        summary: 'Apoio tecnico operacional e suporte de infraestrutura vinculados ao SEINTEC.'
      },
      {
        id: uid(),
        code: 'SEOM',
        name: 'Servico de Obras e Manutencao Escolar',
        lead: 'Nelio Celso Fernandes Junior',
        phone: '(15) 3526-6236',
        email: 'itv.seom@educacao.sp.gov.br',
        summary: 'Infraestrutura, patrimonio, manutencao e cadastro fisico das unidades escolares.'
      },
      {
        id: uid(),
        code: 'SEGRE',
        name: 'Servico de Gestao da Rede Escolar',
        lead: 'Priscila Aparecida Conceicao Souza',
        phone: '(15) 3526-6230',
        email: 'deitvcie@educacao.sp.gov.br',
        summary: 'Gestao da rede, matricula, vida escolar e apoio ao cadastro das unidades.'
      },
      {
        id: uid(),
        code: 'SEVESC',
        name: 'Secao de Vida Escolar',
        lead: 'Vanessa Juliane Antunes Polidoro Rodrigues',
        phone: '(15) 3526-6201',
        email: 'deitvnve@educacao.sp.gov.br',
        summary: 'Vida escolar, registros, documentacao e interface de atendimento com escolas.'
      },
      {
        id: uid(),
        code: 'CRH',
        name: 'Centro de Recursos Humanos',
        lead: 'Hector Antunes de Carvalho',
        phone: '(15) 3526-6204',
        email: 'deitvcrh@educacao.sp.gov.br',
        summary: 'Fluxos de pessoas, pessoal, orientacoes funcionais e apoio ao SEPES.'
      },
      {
        id: uid(),
        code: 'ESE',
        name: 'Equipe de Supervisao de Ensino',
        lead: 'Equipe de Supervisores da URE Itapeva',
        phone: '(15) 3526-6227 / 6217 / 6232 / 6208 / 6216 / 6224',
        email: 'daiane.ribeiro@educacao.sp.gov.br',
        summary: 'Supervisao, acompanhamento pedagogico, programas e orientacao das unidades.'
      }
    ],
    directoryContacts: [
      { id: uid(), name: 'Vanessa Juliane Antunes Polidoro Rodrigues', role: 'Chefe de Secao - SEVESC', phone: '(15) 3526-6201', email: 'deitvnve@educacao.sp.gov.br' },
      { id: uid(), name: 'Juli Francis Oliveira Roza', role: 'Executiva Publica - ASURE', phone: '(15) 3526-6219', email: 'deitvat@educacao.sp.gov.br' },
      { id: uid(), name: 'Elenira Trindade Diniz', role: 'Executivo Publico', phone: '(15) 3526-6231', email: 'deitvnfp@educacao.sp.gov.br' },
      { id: uid(), name: 'Jefferson do Espirito Santo Moreira', role: 'Analista Prodesp', phone: '(15) 3526-6235', email: 'deitvnit@educacao.sp.gov.br' },
      { id: uid(), name: 'Rodolfo Rodrigues Pereira', role: 'Chefe de Servico - SEAFIN', phone: '(15) 3526-6240', email: 'deitvcaf@educacao.sp.gov.br' },
      { id: uid(), name: 'Daniel Duchen Hiromitus', role: 'Chefe de Secao - SEFISC', phone: '(15) 3526-6206', email: 'deitvnfi@educacao.sp.gov.br' },
      { id: uid(), name: 'Nelson da Conceicao Junior', role: 'Chefe de Secao - SEFIN', phone: '(15) 3526-6237', email: 'deitvnfi@educacao.sp.gov.br' },
      { id: uid(), name: 'Elcio Renato Bonifacio de Azevedo', role: 'Chefe de Servico - SEINTEC', phone: '(15) 3526-6211', email: 'deitvnit@educacao.sp.gov.br' },
      { id: uid(), name: 'Nelio Celso Fernandes Junior', role: 'Chefe de Servico - SEOM', phone: '(15) 3526-6236', email: 'deitvnom@educacao.sp.gov.br' },
      { id: uid(), name: 'Rafael Alves Machado', role: 'Oficial Administrativo', phone: '(15) 3526-6209', email: 'deitvnad@educacao.sp.gov.br' },
      { id: uid(), name: 'Juliana de Fatima Rodrigues Lopes de Jesus', role: 'Analista Sociocultural', phone: '(15) 3526-6200', email: 'deitvnad@educacao.sp.gov.br' },
      { id: uid(), name: 'Leticia Aparecida Alves dos Santos', role: 'Diretor I - Nucleo de Frequencia e Pagamento', phone: '(15) 3526-6205', email: 'deitvnfp@educacao.sp.gov.br' },
      { id: uid(), name: 'Paulo Sergio de Oliveira', role: 'Oficial Administrativo', phone: '(15) 3526-6222', email: 'deitvnfp@educacao.sp.gov.br' },
      { id: uid(), name: 'Fabricio Santos', role: 'Chefe de Secao - SECOMSE', phone: '(15) 3526-6238', email: 'deitvncs@educacao.sp.gov.br' },
      { id: uid(), name: 'Hector Antunes de Carvalho', role: 'Diretor II - Centro de Recursos Humanos', phone: '(15) 3526-6204', email: 'deitvcrh@educacao.sp.gov.br' },
      { id: uid(), name: 'Wania Chrischner Nunes Figueiredo', role: 'Professor Readaptado', phone: '(15) 3526-6203', email: 'deitvnap@educacao.sp.gov.br' },
      { id: uid(), name: 'Priscila Aparecida Conceicao Souza', role: 'Chefe de Servico - SEGRE', phone: '(15) 3526-6230', email: 'deitvcie@educacao.sp.gov.br' },
      { id: uid(), name: 'Rosinei Dell Anhol', role: 'Chefe de Secao - Matricula', phone: '(15) 3526-6228', email: 'deitvnve@educacao.sp.gov.br' },
      { id: uid(), name: 'Juliano Lobo Ribeiro', role: 'Assistente II', phone: '(15) 3526-6225', email: 'juliano.ribeiro@educacao.sp.gov.br' },
      { id: uid(), name: 'Daiane Aparecida de Oliveira Ribeiro', role: 'Supervisor Educacional', phone: '(15) 3526-6227', email: 'daiane.ribeiro@educacao.sp.gov.br' },
      { id: uid(), name: 'Edilene da Silva Almeida Oliveira', role: 'Supervisor Educacional', phone: '(15) 3526-6217', email: 'edilene.oliveira@educacao.sp.gov.br' },
      { id: uid(), name: 'Magda Gisele Silva de Oliveira', role: 'Supervisor Educacional', phone: '(15) 3526-6232', email: 'magda.oliveira@educacao.sp.gov.br' },
      { id: uid(), name: 'Marcio Nunes da Cruz', role: 'Supervisor Educacional', phone: '(15) 3526-6208', email: 'marcio.cruz@educacao.sp.gov.br' },
      { id: uid(), name: 'Maria Luiza Brizolla de Queiroz', role: 'Supervisor Educacional', phone: '(15) 3526-6216', email: 'maria.queiroz14@educacao.sp.gov.br' },
      { id: uid(), name: 'Adilson Fogaca', role: 'Supervisor Educacional', phone: '(15) 3526-6224', email: 'adilson.fogaca@educacao.sp.gov.br' }
    ],
    officialLinks: [
      { id: uid(), label: 'Portal da Diretoria de Ensino de Itapeva', url: 'https://deitapeva.educacao.sp.gov.br/' },
      { id: uid(), label: 'Escolas da URE Itapeva', url: 'https://deitapeva.educacao.sp.gov.br/escolas/' },
      { id: uid(), label: 'Lista de ramais da URE Itapeva', url: 'https://deitapeva.educacao.sp.gov.br/lista-de-ramais/' },
      { id: uid(), label: 'Fale Conosco da URE Itapeva', url: 'https://deitapeva.educacao.sp.gov.br/central-de-atendimento/' },
      { id: uid(), label: 'SIC.SP - Informacoes ao Cidadao', url: 'https://deitapeva.educacao.sp.gov.br/sic-sp-informacoes-ao-cidadao/' },
      { id: uid(), label: 'Pagina do SEINTEC', url: 'https://deitapeva.educacao.sp.gov.br/nucleo-de-informacoes-educacionais-e-tecnologia/' },
      { id: uid(), label: 'Pagina do SEOM', url: 'https://deitapeva.educacao.sp.gov.br/nucleo-de-obras-e-manut-escolar/' },
      { id: uid(), label: 'Equipe de Supervisao de Ensino', url: 'https://deitapeva.educacao.sp.gov.br/equipe-de-supervisao-escolar/' },
      { id: uid(), label: 'Secretaria Escolar Digital', url: 'https://sed.educacao.sp.gov.br/' },
      { id: uid(), label: 'Centro de Midias', url: 'https://cmspweb.ip.tv/' }
    ],
    checklist: [
      { id: uid(), text: 'Conferir chamados abertos e prioridades do SEINTEC', done: false },
      { id: uid(), text: 'Revisar escolas em atencao da regional antes da rota', done: false },
      { id: uid(), text: 'Validar se ha redes ou boletins para processamento no dia', done: true }
    ],
    tasks: [],
    calls: [],
    schools,
    supervisors,
    supervisorVisits: defaultSupervisorVisits(supervisors),
    schoolProfiles: defaultSchoolProfiles(schools),
    schoolImports: GENERATED_SCHOOL_DATA.schoolImports || [],
    schoolAssets: GENERATED_SCHOOL_DATA.schoolAssets || [],
    schoolNetworks: GENERATED_SCHOOL_DATA.schoolNetworks || [],
    assets: GENERATED_SCHOOL_DATA.generalAssets || [],
    notes: [],
    histories: {
      calls: [],
      visits: [],
      schoolEvents: []
    },
    ponto: {
      entrada: '',
      saida: ''
    },
    redes: {
      folderPath: '',
      yearSuffix: '26',
      numberPlaceholder: '{{REDE_NUMERO}}',
      datePlaceholder: '{{REDE_DATA}}',
      headingPlaceholder: '{{REDE_CABECALHO}}',
      assuntoLabel: 'Assunto:'
    }
  };
}

function mergeState(saved) {
  const base = createDefaults();
  if (!saved || typeof saved !== 'object') return base;
  const repaired = deepRepairStrings(saved);
  const savedVersion = Number(repaired.stateVersion || 1);
  const lastUpdatedAt = repaired.lastUpdatedAt || new Date().toISOString();
  const savedMunicipalities = Array.isArray(repaired.municipalities) ? repaired.municipalities.filter((item) => normalizeKey(item.name) !== normalizeKey('Nao definido')) : [];
  const savedSectors = Array.isArray(repaired.sectors) ? repaired.sectors : [];
  const savedDirectoryContacts = Array.isArray(repaired.directoryContacts) ? repaired.directoryContacts : [];
  const savedOfficialLinks = Array.isArray(repaired.officialLinks) ? repaired.officialLinks : [];
  const savedSchools = Array.isArray(repaired.schools)
    ? repaired.schools.map((item) => ({ ...item, name: canonicalSchoolName(item.name) }))
    : [];
  const mergedSchools = mergeSchools(base.schools, savedSchools);
  const baseProfiles = defaultSchoolProfiles(mergedSchools);
  const savedSchoolImports = Array.isArray(repaired.schoolImports)
    ? repaired.schoolImports.map((item) => ({ ...item, school: canonicalSchoolName(item.school) }))
    : [];
  const savedSchoolAssets = Array.isArray(repaired.schoolAssets)
    ? repaired.schoolAssets.map((item) => ({ ...item, school: canonicalSchoolName(item.school) }))
    : [];
  const savedSchoolNetworks = Array.isArray(repaired.schoolNetworks)
    ? repaired.schoolNetworks.map((item) => ({ ...item, school: canonicalSchoolName(item.school) }))
    : [];
  const savedTasks = Array.isArray(repaired.tasks)
    ? repaired.tasks.map((item) => ({ ...item, place: canonicalSchoolName(item.place) || item.place }))
    : base.tasks;
  const savedCalls = Array.isArray(repaired.calls)
    ? repaired.calls.map((item) => ({ ...item, school: canonicalSchoolName(item.school) || item.school }))
    : base.calls;
  const savedSupervisors = Array.isArray(repaired.supervisors) ? repaired.supervisors : [];
  const savedSupervisorVisits = Array.isArray(repaired.supervisorVisits)
    ? repaired.supervisorVisits.map((item) => ({ ...item, school: canonicalSchoolName(item.school) || item.school }))
    : [];
  return {
    ...base,
    stateVersion: Math.max(STATE_VERSION, savedVersion),
    lastUpdatedAt,
    profile: { ...base.profile, ...(repaired.profile || {}) },
    users: normalizeDefaultUserNames(mergeUniqueBy(
      base.users,
      Array.isArray(repaired.users) ? repaired.users : [],
      (item) => normalizeKey(item.id || item.login || item.name)
    ).map((item) => ({ ...item, active: item.active !== false }))),
    officialContacts: { ...base.officialContacts, ...(repaired.officialContacts || {}) },
    municipalities: mergeUniqueBy(base.municipalities, savedMunicipalities, (item) => normalizeKey(item.name)),
    sectors: mergeUniqueBy(base.sectors, savedSectors, (item) => normalizeKey(item.code || item.name)),
    directoryContacts: mergeUniqueBy(base.directoryContacts, savedDirectoryContacts, (item) => normalizeKey(item.email || item.name)),
    officialLinks: mergeUniqueBy(base.officialLinks, savedOfficialLinks, (item) => normalizeKey(item.url || item.label)),
    checklist: Array.isArray(repaired.checklist) ? repaired.checklist : base.checklist,
    tasks: savedTasks,
    calls: savedCalls,
    schools: mergedSchools,
    supervisors: mergeUniqueBy(base.supervisors, savedSupervisors, (item) => normalizeKey(item.email || item.name)),
    supervisorVisits: mergeUniqueBy(
      base.supervisorVisits,
      savedSupervisorVisits,
      (item) => normalizeKey(`${item.supervisor}|${item.school}|${item.date}|${item.type}`)
    ),
    schoolProfiles: mergeUniqueBy(
      baseProfiles,
      Array.isArray(repaired.schoolProfiles) ? repaired.schoolProfiles : [],
      (item) => normalizeKey(item.school)
    ).map((item) => {
      const canonicalName = canonicalSchoolName(item.school);
      const school = mergedSchools.find((entry) => normalizeKey(entry.name) === normalizeKey(canonicalName));
      return {
        ...item,
        school: school ? school.name : canonicalName,
        municipality: item.municipality || school?.zone || ''
      };
    }),
    schoolImports: mergeUniqueBy(
      base.schoolImports,
      savedSchoolImports,
      (item) => normalizeKey(`${item.school}|${item.label || item.filename || item.id}`)
    ).map((item) => ({
      ...item,
      reviewStatus: inferImportReviewStatus(item)
    })),
    schoolAssets: mergeUniqueBy(
      base.schoolAssets,
      savedSchoolAssets,
      (item) => normalizeKey(`${item.school}|${item.name}|${item.notes || ''}`)
    ),
    schoolNetworks: mergeUniqueBy(
      base.schoolNetworks,
      savedSchoolNetworks,
      (item) => normalizeKey(`${item.school}|${item.adminNetwork || ''}|${item.pedNetwork || ''}|${item.cie || ''}`)
    ),
    assets: mergeUniqueBy(
      base.assets,
      Array.isArray(repaired.assets) ? repaired.assets : [],
      (item) => normalizeKey(`${item.place}|${item.name}|${item.notes || ''}`)
    ),
    notes: Array.isArray(repaired.notes) ? repaired.notes : base.notes,
    histories: {
      calls: repaired.histories?.calls || base.histories.calls,
      visits: repaired.histories?.visits || base.histories.visits,
      schoolEvents: repaired.histories?.schoolEvents || base.histories.schoolEvents
    },
    ponto: { ...base.ponto, ...(repaired.ponto || {}) },
    redes: { ...base.redes, ...(repaired.redes || {}) }
  };
}

function loadState() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return mergeState(JSON.parse(current));
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) return mergeLegacyState(JSON.parse(legacy));
  } catch {
    return createDefaults();
  }
  return createDefaults();
}

function saveState() {
  state.stateVersion = STATE_VERSION;
  state.lastUpdatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function mergeLegacyState(saved) {
  const merged = mergeState(saved);
  if (!merged.officialContacts?.office) {
    merged.officialContacts = {
      ...merged.officialContacts,
      office: 'Diretoria de Ensino - Itapeva | suporte setorial e rede escolar'
    };
  }
  return merged;
}
