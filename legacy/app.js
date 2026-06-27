/* ==========================================================
   OCULOSAAS - SUITE GESTION CLINIQUE & OPTIQUE (AFRIQUE DE L'OUEST)
   LOGIQUE APPLICATIVE COMPLETE AVEC DESIGN SYSTEM CLAIR/SOMBRE
   ========================================================== */

// Dictionnaire multilingue étendu (FR, EN, PT)
const translations = {
  fr: {
    "nav.dashboard": "Tableau de bord",
    "nav.patients": "Patients",
    "nav.consultations": "Consultations",
    "nav.optics": "Stock Optique",
    "nav.atelier": "Atelier de Montage",
    "nav.caisse": "Caisse & Ventes",
    "nav.rendezvous": "Rendez-vous",
    "nav.chirurgies": "Chirurgies & Suivi",
    "nav.rh": "Ressources Humaines",
    "nav.finance": "Finance & Comptabilité",
    "nav.settings": "Paramètres",
    
    "search.placeholder": "Rechercher patient, ordonnance...",
    
    "auth.subtitle": "Gestion Clinique & Optique - Afrique de l'Ouest & Centrale",
    "auth.usernameEmail": "Email ou Nom d'utilisateur",
    "auth.password": "Mot de passe",
    "auth.remember": "Se souvenir de moi",
    "auth.forgot": "Mot de passe oublié ?",
    "auth.submit": "Se connecter",
    "auth.resetTitle": "Réinitialisation du mot de passe",
    "auth.resetDesc": "Saisissez votre e-mail pour recevoir un lien de récupération sécurisé.",
    "auth.back": "Retour",
    "auth.sendReset": "Envoyer",
    
    "lock.sessionLocked": "Session Verrouillée",
    "lock.enterPassword": "Saisissez votre mot de passe pour déverrouiller l'écran.",
    "lock.unlock": "Déverrouiller",

    "sync.online": "En ligne",
    "sync.offline": "Hors-ligne",
    
    "theme.light": "Clair",
    "theme.dark": "Sombre",
    "theme.auto": "Auto",
    
    "notif.title": "Alertes & Notifications",
    "notif.markRead": "Tout marquer lu",
    
    "dash.title": "Tableau de bord intelligent",
    "dash.subtitle": "Aperçu en temps réel et prévisions de votre clinique/boutique",
    "dash.revenue": "Chiffre d'Affaires",
    "dash.vsMonth": "vs mois dernier",
    "dash.consultations": "Consultations (Mois)",
    "dash.stockAlert": "Alertes de Stock",
    "dash.needReorder": "Articles sous le seuil critique",
    "dash.chartTitle": "Analyse des revenus & Consultations",
    "dash.realtime": "Temps Réel",
    "dash.aiTitle": "Moteur IA Prédictif",
    "dash.active": "Actif",
    "dash.aiForecastTitle": "Prévision de Stock Optique (30j)",
    "dash.aiForecastText": "Les modèles prévoient une augmentation de 25% de la demande sur les verres progressifs antireflets de marque Seiko au Sénégal et en Côte d'Ivoire en raison de la rentrée universitaire.",
    "dash.aiRecommendation": "Recommandation : Commander +15 unités de verres Seiko.",
    "dash.recentAppts": "Rendez-vous du jour",
    "dash.viewAll": "Voir tout",
    
    "patients.title": "Gestion des Patients",
    "patients.subtitle": "Dossiers médicaux, ordonnances, antécédents et imagerie",
    "patients.addBtn": "Nouveau Patient",
    "patients.searchPlaceholder": "Rechercher par nom, téléphone, NID...",
    "patients.tblId": "Code",
    "patients.tblName": "Nom & Prénoms",
    "patients.tblAge": "Âge / Genre",
    "patients.tblPhone": "Téléphone",
    "patients.tblLastVisit": "Dernière visite",
    "patients.selectTitle": "Aucun patient sélectionné",
    "patients.selectDesc": "Sélectionnez un patient de la liste de gauche pour afficher son dossier médical complet.",
    "patients.consultBtn": "Consulter",
    "patients.tabFiche": "Fiche & Antécédents",
    "patients.tabConsultations": "Consultations & Réfraction",
    "patients.tabExamens": "Imagerie & Examens",
    "patients.tabOrdonnances": "Ordonnances & Factures",
    "patients.contactInfo": "Coordonnées",
    "patients.medicalInfo": "Informations Médicales",
    "patients.antecedents": "Antécédents Systémiques & Oculaires",
    "patients.notes": "Notes Générales & Allergies",
    
    "filter.allGenders": "Tous les genres",
    "filter.male": "Homme",
    "filter.female": "Femme",
    
    "consult.title": "Consultations Ophtalmologiques",
    "consult.subtitle": "Examens cliniques, réfractions, biomicroscopie et diagnostics",
    "consult.recentTitle": "Toutes les consultations récentes",
    "consult.tblDate": "Date",
    "consult.tblPatient": "Patient",
    "consult.tblDoctor": "Docteur",
    "consult.tblRefraction": "Réfraction Prescrite",
    "consult.tblDiagnostic": "Diagnostic",
    "consult.tblActions": "Actions",
    
    "optics.title": "Gestion du Magasin d'Optique & Stocks",
    "optics.subtitle": "Suivi du catalogue des montures, des verres et des commandes",
    "optics.addBtn": "Ajouter un article",
    "optics.tabFrames": "Montures",
    "optics.tabLenses": "Verres correcteurs",
    "optics.tabSuppliers": "Fournisseurs & Commandes",
    
    "caisse.title": "Ventes, Caisse & Devis",
    "caisse.subtitle": "Vente de montures, verres, examens et facturation client",
    "caisse.drawerOpen": "Caisse ouverte",
    "caisse.assocPatient": "Associer un Patient",
    "caisse.catalog": "Catalogue Caisse",
    "caisse.basket": "Panier de Vente",
    "caisse.subtotal": "Sous-total",
    "caisse.total": "Net à Payer (Patient)",
    "caisse.paymentMethod": "Moyen de paiement",
    "caisse.quoteBtn": "Devis Optique",
    "caisse.payBtn": "Valider l'Encaissement",
    "caisse.cinetpaySecure": "Transactions cryptées et sécurisées par CinetPay.",
    
    "appt.title": "Calendrier Interactif & Rendez-vous",
    "appt.subtitle": "Planifiez les consultations d'optique et les blocs opératoires",
    "appt.addBtn": "Nouveau Rendez-vous",
    "appt.viewMonth": "Mois",
    "appt.viewWeek": "Semaine",
    
    "surgery.title": "Chirurgies & Suivi Postopératoire",
    "surgery.subtitle": "Planification opératoire (cataracte, glaucome, laser) et contrôles postopératoires",
    "surgery.addBtn": "Planifier Chirurgie",
    "surgery.tblTitle": "Liste des chirurgies planifiées et suivis",
    
    "finance.title": "Finance, Comptabilité & Rapports",
    "finance.subtitle": "Analyse détaillée du chiffre d'affaires, des dépenses et répartition des règlements",
    "finance.export": "Exporter les rapports (CSV)",
    
    "settings.title": "Paramètres Généraux",
    "settings.subtitle": "Sécurité médicale, RGPD, sauvegardes cloud et configuration clinique"
  },
  en: {
    "nav.dashboard": "Dashboard",
    "nav.patients": "Patients",
    "nav.consultations": "Consultations",
    "nav.optics": "Optical Stock",
    "nav.atelier": "Assembly Workshop",
    "nav.caisse": "POS & Sales",
    "nav.rendezvous": "Appointments",
    "nav.chirurgies": "Surgeries & Follow-up",
    "nav.rh": "Human Resources",
    "nav.finance": "Finance & Accounting",
    "nav.settings": "Settings",
    
    "search.placeholder": "Search patient, prescription...",
    
    "auth.subtitle": "Clinical & Optical Management - West & Central Africa",
    "auth.usernameEmail": "Email or Username",
    "auth.password": "Password",
    "auth.remember": "Remember me",
    "auth.forgot": "Forgot password?",
    "auth.submit": "Log In",
    "auth.resetTitle": "Password Recovery",
    "auth.resetDesc": "Enter your email to receive a secure recovery link.",
    "auth.back": "Back",
    "auth.sendReset": "Send Link",
    
    "lock.sessionLocked": "Session Locked",
    "lock.enterPassword": "Enter your password to unlock the screen.",
    "lock.unlock": "Unlock",

    "sync.online": "Online",
    "sync.offline": "Offline",
    
    "theme.light": "Light",
    "theme.dark": "Dark",
    "theme.auto": "Auto",
    
    "notif.title": "Alerts & Notifications",
    "notif.markRead": "Mark all read",
    
    "dash.title": "Intelligent Dashboard",
    "dash.subtitle": "Real-time overview and forecasts for your clinic/shop",
    "dash.revenue": "Turnover",
    "dash.vsMonth": "vs last month",
    "dash.consultations": "Consultations (Month)",
    "dash.stockAlert": "Stock Alerts",
    "dash.needReorder": "Articles below threshold",
    "dash.chartTitle": "Revenue & Consultations Analysis",
    "dash.realtime": "Real-Time",
    "dash.aiTitle": "Predictive AI Engine",
    "dash.active": "Active",
    "dash.aiForecastTitle": "Optical Stock Forecast (30d)",
    "dash.aiForecastText": "Models predict a 25% increase in demand for Seiko progressive lenses in Senegal and Ivory Coast due to the back-to-school season.",
    "dash.aiRecommendation": "Recommendation: Order +15 units of Seiko lenses.",
    "dash.recentAppts": "Today's Appointments",
    "dash.viewAll": "View all",
    
    "patients.title": "Patients Management",
    "patients.subtitle": "Medical files, prescriptions, history and imaging",
    "patients.addBtn": "New Patient",
    "patients.searchPlaceholder": "Search by name, phone, NID...",
    "patients.tblId": "Code",
    "patients.tblName": "Full Name",
    "patients.tblAge": "Age / Gender",
    "patients.tblPhone": "Phone",
    "patients.tblLastVisit": "Last visit",
    "patients.selectTitle": "No patient selected",
    "patients.selectDesc": "Select a patient from the list on the left to view their file.",
    "patients.consultBtn": "Consult",
    "patients.tabFiche": "File & History",
    "patients.tabConsultations": "Consultations & Refraction",
    "patients.tabExamens": "Imaging & Exams",
    "patients.tabOrdonnances": "Prescriptions & Invoices",
    "patients.contactInfo": "Contact Info",
    "patients.medicalInfo": "Medical Information",
    "patients.antecedents": "Systemic & Ocular History",
    "patients.notes": "Notes & Allergies",
    
    "filter.allGenders": "All genders",
    "filter.male": "Male",
    "filter.female": "Female",
    
    "consult.title": "Ophthalmic Consultations",
    "consult.subtitle": "Clinical examinations, refractions, biomicroscopy and diagnostics",
    "consult.recentTitle": "All recent consultations",
    "consult.tblDate": "Date",
    "consult.tblPatient": "Patient",
    "consult.tblDoctor": "Doctor",
    "consult.tblRefraction": "Prescribed Refraction",
    "consult.tblDiagnostic": "Diagnosis",
    "consult.tblActions": "Actions",
    
    "optics.title": "Optical Shop & Stocks Management",
    "optics.subtitle": "Follow-up of frames catalog, lenses and orders",
    "optics.addBtn": "Add article",
    "optics.tabFrames": "Frames",
    "optics.tabLenses": "Corrective Lenses",
    "optics.tabSuppliers": "Suppliers & Orders",
    
    "caisse.title": "Sales, POS & Quotes",
    "caisse.subtitle": "Sale of frames, lenses, clinical acts and invoicing",
    "caisse.drawerOpen": "Drawer open",
    "caisse.assocPatient": "Associate a Patient",
    "caisse.catalog": "POS Catalog",
    "caisse.basket": "Shopping Basket",
    "caisse.subtotal": "Subtotal",
    "caisse.total": "Net Patient Payment",
    "caisse.paymentMethod": "Payment Method",
    "caisse.quoteBtn": "Optical Quote",
    "caisse.payBtn": "Validate Cash Receipt",
    "caisse.cinetpaySecure": "Transactions encrypted and secured by CinetPay.",
    
    "appt.title": "Interactive Calendar & Appointments",
    "appt.subtitle": "Plan optical consultations and operating theaters",
    "appt.addBtn": "New Appointment",
    "appt.viewMonth": "Month",
    "appt.viewWeek": "Week",
    
    "surgery.title": "Surgeries & Postop Follow-up",
    "surgery.subtitle": "Operative planning (cataract, glaucoma, laser) and post-op checks",
    "surgery.addBtn": "Plan Surgery",
    "surgery.tblTitle": "Scheduled surgeries & follow-ups",
    
    "finance.title": "Finance, Accounting & Reports",
    "finance.subtitle": "Detailed analysis of turnover, expenses and payment split",
    "finance.export": "Export reports (CSV)",
    
    "settings.title": "General Settings",
    "settings.subtitle": "Medical security, GDPR, cloud backups and clinic configuration"
  },
  pt: {
    "nav.dashboard": "Painel de Controle",
    "nav.patients": "Pacientes",
    "nav.consultations": "Consultas",
    "nav.optics": "Estoque Óptico",
    "nav.atelier": "Oficina de Montagem",
    "nav.caisse": "Caixa & Vendas",
    "nav.rendezvous": "Consultas Agendadas",
    "nav.chirurgies": "Cirurgias & Acompanhamento",
    "nav.rh": "Recursos Humanos",
    "nav.finance": "Finanças & Contabilidade",
    "nav.settings": "Configurações",
    
    "search.placeholder": "Pesquisar paciente, receita...",
    
    "auth.subtitle": "Gestão Clínica e Óptica - África Ocidental e Central",
    "auth.usernameEmail": "Email ou Nome de usuário",
    "auth.password": "Senha",
    "auth.remember": "Lembrar-me",
    "auth.forgot": "Esqueceu a senha?",
    "auth.submit": "Conectar",
    "auth.resetTitle": "Recuperação de Senha",
    "auth.resetDesc": "Digite seu e-mail para receber um link de recuperação seguro.",
    "auth.back": "Voltar",
    "auth.sendReset": "Enviar Link",
    
    "lock.sessionLocked": "Sessão Bloqueada",
    "lock.enterPassword": "Digite sua senha para desbloquear a tela.",
    "lock.unlock": "Desbloquear",

    "sync.online": "Online",
    "sync.offline": "Offline",
    
    "theme.light": "Claro",
    "theme.dark": "Escuro",
    "theme.auto": "Auto",
    
    "notif.title": "Alertas e Notificações",
    "notif.markRead": "Marcar todas como lidas",
    
    "dash.title": "Painel Inteligente",
    "dash.subtitle": "Visão geral em tempo real e previsões para sua clínica/loja",
    "dash.revenue": "Faturamento",
    "dash.vsMonth": "vs mês passado",
    "dash.consultations": "Consultas (Mês)",
    "dash.stockAlert": "Alertas de Estoque",
    "dash.needReorder": "Artigos abaixo do limite crítico",
    "dash.chartTitle": "Análise de Faturamento & Consultas",
    "dash.realtime": "Tempo Real",
    "dash.aiTitle": "Motor IA Preditivo",
    "dash.active": "Ativo",
    "dash.aiForecastTitle": "Previsão de Estoque Óptico (30d)",
    "dash.aiForecastText": "Modelos prevêem aumento de 25% na demanda por lentes progressivas Seiko na Guiné-Bissau devido ao retorno às aulas.",
    "dash.aiRecommendation": "Recomendação: Encomendar +15 unidades de lentes Seiko.",
    "dash.recentAppts": "Consultas de hoje",
    "dash.viewAll": "Ver tudo",
    
    "patients.title": "Gestão de Pacientes",
    "patients.subtitle": "Fichas médicas, receitas, histórico e exames",
    "patients.addBtn": "Novo Paciente",
    "patients.searchPlaceholder": "Pesquisar por nome, telefone, NID...",
    "patients.tblId": "Código",
    "patients.tblName": "Nome Completo",
    "patients.tblAge": "Idade / Gênero",
    "patients.tblPhone": "Telefone",
    "patients.tblLastVisit": "Última visita",
    "patients.selectTitle": "Nenhum paciente selecionado",
    "patients.selectDesc": "Selecione um paciente na lista à esquerda para ver a ficha completa.",
    "patients.consultBtn": "Consultar",
    "patients.tabFiche": "Ficha & Histórico",
    "patients.tabConsultations": "Consultas & Refração",
    "patients.tabExamens": "Exames & Imagens",
    "patients.tabOrdonnances": "Receitas & Faturas",
    "patients.contactInfo": "Contatos",
    "patients.medicalInfo": "Informações Médicas",
    "patients.antecedents": "Antecedentes Sistêmicos e Oculares",
    "patients.notes": "Notas Gerais e Alergias",
    
    "filter.allGenders": "Todos os gêneros",
    "filter.male": "Masculino",
    "filter.female": "Feminino",
    
    "consult.title": "Consultas Oftalmológicas",
    "consult.subtitle": "Exames clínicos, refrações, biomicroscopia e diagnósticos",
    "consult.recentTitle": "Todas as consultas recentes",
    "consult.tblDate": "Data",
    "consult.tblPatient": "Paciente",
    "consult.tblDoctor": "Médico",
    "consult.tblRefraction": "Refração Prescrita",
    "consult.tblDiagnostic": "Diagnóstico",
    "consult.tblActions": "Ações",
    
    "optics.title": "Gestão de Loja Óptica & Estoque",
    "optics.subtitle": "Controle de armações, lentes correctivas e encomendas",
    "optics.addBtn": "Adicionar artigo",
    "optics.tabFrames": "Armações",
    "optics.tabLenses": "Lentes Graduadas",
    "optics.tabSuppliers": "Fornecedores & Pedidos",
    
    "caisse.title": "Vendas, Caixa & Orçamentos",
    "caisse.subtitle": "Venda de armações, lentes, consultas e faturamento",
    "caisse.drawerOpen": "Caixa aberto",
    "caisse.assocPatient": "Associar um Paciente",
    "caisse.catalog": "Catálogo do Caixa",
    "caisse.basket": "Carrinho de Vendas",
    "caisse.subtotal": "Subtotal",
    "caisse.total": "Net a Pagar pelo Paciente",
    "caisse.paymentMethod": "Método de Pagamento",
    "caisse.quoteBtn": "Orçamento Óptico",
    "caisse.payBtn": "Validar Recebimento",
    "caisse.cinetpaySecure": "Transações criptografadas e seguras pelo CinetPay.",
    
    "appt.title": "Calendário & Consultas Agendadas",
    "appt.subtitle": "Agende consultas ópticas e blocos cirúrgicos",
    "appt.addBtn": "Nova Consulta",
    "appt.viewMonth": "Mês",
    "appt.viewWeek": "Semana",
    
    "surgery.title": "Cirurgias & Acompanhamento",
    "surgery.subtitle": "Planeamento de cirurgias (catarata, glaucoma, laser) e pós-operatório",
    "surgery.addBtn": "Agendar Cirurgia",
    "surgery.tblTitle": "Lista de cirurgias planeadas e acompanhamentos",
    
    "finance.title": "Finanças, Contabilidade & Relatórios",
    "finance.subtitle": "Análise detalhada do faturamento, despesas e pagamentos",
    "finance.export": "Exportar relatórios (CSV)",
    
    "settings.title": "Configurações Gerais",
    "settings.subtitle": "Segurança médica, RGPD, backups na nuvem e clínicas"
  }
};

// Base de données cliniques initiales de OculoSaaS
const INITIAL_PATIENTS = [
  {
    id: "PAT-2026-001",
    name: "Koffi Mensah",
    phone: "+225 07 45 89 65 12",
    birthDate: "1984-05-12",
    gender: "M",
    email: "koffi.mensah@gmail.com",
    profession: "Comptable",
    address: "Cocody Mermoz, Abidjan, Côte d'Ivoire",
    insurance: "SOGEHAB (80%)",
    nationalId: "109827364-CI",
    antecedents: ["Hypertension", "Diabète de Type II", "Antécédent Glaucome familial"],
    notes: "Allergie connue à la Pénicilline. Consulte pour une baisse progressive de la vision de près.",
    lastVisit: "2026-06-15"
  },
  {
    id: "PAT-2026-002",
    name: "Fatou Diop",
    phone: "+221 77 569 82 45",
    birthDate: "1998-10-23",
    gender: "F",
    email: "fatou.diop98@yahoo.sn",
    profession: "Étudiante",
    address: "Fann Résidence, Dakar, Sénégal",
    insurance: "Aucune (Paiement direct)",
    nationalId: "298716254-SN",
    antecedents: ["Porteuse de lentilles de contact"],
    notes: "Demande de renouvellement de prescription et contrôle de réfraction. Légère sécheresse oculaire.",
    lastVisit: "2026-06-20"
  },
  {
    id: "PAT-2026-003",
    name: "Amadou Touré",
    phone: "+223 66 85 92 14",
    birthDate: "1961-02-05",
    gender: "M",
    email: "amadou.toure@afribone.net.ml",
    profession: "Enseignant retraité",
    address: "Hamdallaye ACI, Bamako, Mali",
    insurance: "INPS (90%)",
    nationalId: "7763524-ML",
    antecedents: ["Cataracte sénile œil droit", "Hypertension contrôlée"],
    notes: "Planifié pour chirurgie de la cataracte de l'œil droit par phacoémulsification.",
    lastVisit: "2026-06-26"
  },
  {
    id: "PAT-2026-004",
    name: "Awa Ndiaye",
    phone: "+221 70 892 44 11",
    birthDate: "1972-07-14",
    gender: "F",
    email: "awa.ndiaye.dakar@outlook.com",
    profession: "Commerçante",
    address: "Médina, Dakar, Sénégal",
    insurance: "IPM (70%)",
    nationalId: "19283746-SN",
    antecedents: ["Astigmatisme fort"],
    notes: "Se plaint de céphalées fréquentes en fin de journée. Examen de réfraction complet requis.",
    lastVisit: "2026-06-27"
  }
];

const INITIAL_STOCK = [
  { ref: "MT-RAY-501", type: "monture", brand: "Ray-Ban", model: "Aviator Classic Or", buyPrice: 35000, sellPrice: 65000, qty: 8, minAlert: 3 },
  { ref: "MT-OAK-202", type: "monture", brand: "Oakley", model: "Pitchman R Carbon Matte", buyPrice: 55000, sellPrice: 95000, qty: 1, minAlert: 2 },
  { ref: "MT-GUCCI-02", type: "monture", brand: "Gucci", model: "Havana Rectangular", buyPrice: 85000, sellPrice: 150000, qty: 3, minAlert: 2 },
  { ref: "MT-DIOR-44", type: "monture", brand: "Dior", model: "Black Suit Square", buyPrice: 90000, sellPrice: 165000, qty: 2, minAlert: 2 },
  { ref: "MT-KARA-09", type: "monture", brand: "Karavan", model: "Metal Rouge", buyPrice: 18000, sellPrice: 35000, qty: 12, minAlert: 4 },
  { ref: "VR-SEI-167-BL", type: "verre", brand: "Seiko", model: "Progressif 1.67 Blue-Cut", buyPrice: 30000, sellPrice: 60000, qty: 14, minAlert: 5 },
  { ref: "VR-ESS-150-AR", type: "verre", brand: "Essilor", model: "Unifocal 1.50 Crizal Sapphire", buyPrice: 10000, sellPrice: 25000, qty: 0, minAlert: 5 },
  { ref: "VR-ZEI-160-PH", type: "verre", brand: "Zeiss", model: "Photochromique 1.60 Lotutec", buyPrice: 28000, sellPrice: 55000, qty: 9, minAlert: 3 }
];

const INITIAL_CONSULTATIONS = [
  {
    id: "CNS-001",
    patientId: "PAT-2026-001",
    patientName: "Koffi Mensah",
    doctor: "Dr. Diallo",
    date: "2026-06-15",
    refraction: {
      od: { sph: "+0.50", cyl: "-0.75", axe: "90", add: "+2.25", av: "10/10 Loin • P2 Près" },
      og: { sph: "+0.75", cyl: "-0.50", axe: "85", add: "+2.25", av: "9/10 Loin • P2 Près" }
    },
    tonometrie: { od: "14 mmHg", og: "15 mmHg" },
    biomicroscopie: "Cornée saine, iris régulier, début de sclérose cristallinienne bilatérale.",
    fondOeil: "Papille bien excavée, rapport cup/disc à 0.3. Pas d'hémorragie.",
    diagnostic: "Presbytie débutante + Astigmatisme hypermétropique léger",
    prescriptionVerre: "Verres Progressifs 1.67 Blue-Cut",
    prescriptionMedicale: "Collyre Lubrifiant (Larmabak) 1 goutte 3 fois/jour."
  },
  {
    id: "CNS-002",
    patientId: "PAT-2026-002",
    patientName: "Fatou Diop",
    doctor: "M. Traoré",
    date: "2026-06-20",
    refraction: {
      od: { sph: "-2.50", cyl: "0.00", axe: "0", add: "0.00", av: "10/10 Loin" },
      og: { sph: "-2.75", cyl: "-0.25", axe: "180", add: "0.00", av: "10/10 Loin" }
    },
    tonometrie: { od: "12 mmHg", og: "13 mmHg" },
    biomicroscopie: "Lentilles bien centrées, discrète sécheresse conjonctivale.",
    fondOeil: "Rétine périphérique saine, macula d'aspect normal.",
    diagnostic: "Myopie simple stabilisée",
    prescriptionVerre: "Verres Unifocaux Crizal Sapphire",
    prescriptionMedicale: "Larmes artificielles (Aquify) au besoin."
  }
];

const INITIAL_APPOINTMENTS = [
  { id: "APT-001", patientId: "PAT-2026-001", patientName: "Koffi Mensah", date: "2026-06-27", time: "09:00", type: "consultation", doctor: "Dr. Diallo", notes: "Contrôle annuel", status: "terminé" },
  { id: "APT-002", patientId: "PAT-2026-003", patientName: "Amadou Touré", date: "2026-06-27", time: "11:30", type: "oct", doctor: "Dr. Koné", notes: "OCT Pré-opératoire", status: "confirmé" },
  { id: "APT-003", patientId: "PAT-2026-004", patientName: "Awa Ndiaye", date: "2026-06-27", time: "14:15", type: "refraction", doctor: "M. Traoré", notes: "Baisse de vision", status: "confirmé" },
  { id: "APT-004", patientId: "PAT-2026-002", patientName: "Fatou Diop", date: "2026-06-28", time: "10:00", type: "postop", doctor: "Dr. Diallo", notes: "Suivi post-op", status: "confirmé" }
];

const INITIAL_SURGERIES = [
  {
    id: "SURG-001",
    patientId: "PAT-2026-003",
    patientName: "Amadou Touré",
    doctor: "Dr. Koné",
    type: "Cataracte (Phacoémulsification)",
    eye: "OD",
    date: "2026-06-30",
    notes: "Implant monofocal +21.5 D",
    followUps: ["J+1 (01 Juillet)", "J+7 (07 Juillet)", "J+30 (30 Juillet)"],
    status: "Planifié"
  }
];

const INITIAL_TRANSACTIONS = [
  { id: "TX-9281-OM", date: "2026-06-27 10:20", patientName: "Koffi Mensah", items: "Monture Ray-Ban + Verres Progressifs Seiko", method: "orange", amount: 125000, status: "succès" },
  { id: "TX-1102-WV", date: "2026-06-27 11:45", patientName: "Fatou Diop", items: "Verres Essilor Unifocaux + Contrôle réfraction", method: "wave", amount: 35000, status: "succès" },
  { id: "TX-8927-CH", date: "2026-06-27 13:10", patientName: "Passage anonyme", items: "Monture Karavan", method: "cash", amount: 35000, status: "succès" }
];

const INITIAL_NOTIFICATIONS = [
  { id: "NOT-001", recipient: "Koffi Mensah", channel: "WhatsApp", message: "Bonjour Koffi Mensah, votre rendez-vous est prévu le 27 Juin 2026 à 09:00 à la Clinique Dakar - Plateau.", date: "2026-06-26 18:00", status: "délivré" },
  { id: "NOT-002", recipient: "Fatou Diop", channel: "SMS", message: "Bonjour Fatou Diop, rappel de votre rendez-vous de contrôle le 28 Juin 2026 à 10:00 avec Dr. Diallo.", date: "2026-06-27 08:30", status: "envoyé" },
  { id: "NOT-003", recipient: "Amadou Touré", channel: "WhatsApp", message: "Cher Amadou Touré, nous vous rappelons votre chirurgie de la cataracte le 30 Juin 2026 à 08:00. Rester à jeun.", date: "2026-06-27 10:15", status: "délivré" }
];

// Base de données RH et Comptabilité étendues de OculoSaaS
const INITIAL_EMPLOYEES = [
  { id: "EMP-01", name: "Dr. Amadou Diallo", phone: "+221 77 123 45 67", email: "diallo@oculo.africa", role: "ophtalmo", salary: 1200000, status: "Actif", branch: "dakar_plateau" },
  { id: "EMP-02", name: "M. Sekou Traoré", phone: "+225 07 45 12 89 56", email: "traore@oculo.africa", role: "opticien", salary: 650000, status: "Actif", branch: "abidjan_cocody" },
  { id: "EMP-03", name: "Mme Fatoumata Sow", phone: "+221 70 890 12 34", email: "sow@oculo.africa", role: "receptionniste", salary: 300000, status: "Actif", branch: "dakar_plateau" },
  { id: "EMP-04", name: "M. Koffi N'Guessan", phone: "+225 05 66 12 34 56", email: "koffi@oculo.africa", role: "caissier", salary: 280000, status: "Actif", branch: "abidjan_cocody" },
  { id: "EMP-05", name: "Mme Awa Cissé", phone: "+221 77 987 65 43", email: "cisse@oculo.africa", role: "comptable", salary: 500000, status: "Actif", branch: "dakar_plateau" }
];

const INITIAL_LEAVE_REQUESTS = [
  { id: "LV-01", employeeName: "Mme Fatoumata Sow", start: "2026-07-10", end: "2026-07-24", type: "Congés Annuels", status: "En attente" },
  { id: "LV-02", employeeName: "M. Sekou Traoré", start: "2026-06-01", end: "2026-06-05", type: "Maladie", status: "Approuvé" }
];

const INITIAL_EXPENSES = [
  { id: "EXP-001", cat: "Loyer", date: "2026-06-01", desc: "Loyer Dakar Plateau", amount: 600000, hasFile: true },
  { id: "EXP-002", cat: "Électricité", date: "2026-06-10", desc: "Facture Senelec", amount: 150000, hasFile: true },
  { id: "EXP-003", cat: "Internet", date: "2026-06-12", desc: "Abonnement Orange Fibre", amount: 50000, hasFile: false }
];

const INITIAL_LEDGER = [
  { id: "LED-001", date: "2026-06-27 08:00", label: "Ouverture Caisse (Fond déclaré)", debit: 150000, credit: 0, balance: 150000 },
  { id: "LED-002", date: "2026-06-27 10:20", label: "Règlement Orange Money - Koffi Mensah", debit: 125000, credit: 0, balance: 275000 },
  { id: "LED-003", date: "2026-06-27 11:45", label: "Règlement Wave - Fatou Diop", debit: 35000, credit: 0, balance: 310000 },
  { id: "LED-004", date: "2026-06-27 12:00", label: "Dépense - Fournitures bureau", debit: 0, credit: 15000, balance: 295000 }
];

const INITIAL_ATELIER_JOBS = [
  { id: "JOB-001", patientName: "Koffi Mensah", frame: "Ray-Ban Aviator", lens: "Seiko Progressif 1.67 Blue-Cut", optician: "M. Traoré", status: "En cours de montage" },
  { id: "JOB-002", patientName: "Fatou Diop", frame: "Karavan Rouge", lens: "Essilor Unifocal 1.50", optician: "M. Traoré", status: "Prêt pour livraison" }
];

const INITIAL_SECURITY_LOG = [
  { date: "2026-06-27 13:42:01", user: "Dr. Diallo", action: "Connexion réussie", ip: "197.34.120.45", status: "Succès" },
  { date: "2026-06-27 13:40:15", user: "Dr. Diallo", action: "Tentative de connexion", ip: "197.34.120.45", status: "Échec (MDP incorrect)" },
  { date: "2026-06-27 10:15:30", user: "Mme Sow", action: "Ouverture de session", ip: "197.34.121.22", status: "Succès" }
];

const INITIAL_PERMISSIONS = {
  "ophtalmo": { clinique: true, optique: false, atelier: false, caisse: false, rh: false, finance: false },
  "opticien": { clinique: true, optique: true, atelier: true, caisse: true, rh: false, finance: false },
  "receptionniste": { clinique: false, optique: false, atelier: false, caisse: true, rh: false, finance: false },
  "comptable": { clinique: false, optique: false, atelier: false, caisse: false, rh: true, finance: true },
  "caissier": { clinique: false, optique: false, atelier: false, caisse: true, rh: false, finance: false },
  "admin": { clinique: true, optique: true, atelier: true, caisse: true, rh: true, finance: true }
};

// OculoSaaS App Engine Class
class OculoSaaSApp {
  constructor() {
    this.state = {
      isLoggedIn: localStorage.getItem("oculo_isLoggedIn") === "true",
      lang: localStorage.getItem("oculo_lang") || "fr",
      theme: localStorage.getItem("oculo_theme") || "light",
      currency: localStorage.getItem("oculo_currency") || "XOF",
      activeTab: "dashboard",
      selectedClinic: localStorage.getItem("oculo_clinic") || "dakar_plateau",
      selectedRole: localStorage.getItem("oculo_role") || "ophtalmo",
      isOnline: true,
      
      // Caisse drawer
      isCashDrawerOpen: localStorage.getItem("oculo_drawerOpen") !== "false",
      cashDrawerAmount: parseFloat(localStorage.getItem("oculo_drawerAmount") || "150000"),

      // Données réactives
      patients: this.loadData("patients", INITIAL_PATIENTS),
      stock: this.loadData("stock", INITIAL_STOCK),
      consultations: this.loadData("consultations", INITIAL_CONSULTATIONS),
      appointments: this.loadData("appointments", INITIAL_APPOINTMENTS),
      surgeries: this.loadData("surgeries", INITIAL_SURGERIES),
      transactions: this.loadData("transactions", INITIAL_TRANSACTIONS),
      notifications: this.loadData("notifications", INITIAL_NOTIFICATIONS),
      
      // Données refactorisées
      employees: this.loadData("employees", INITIAL_EMPLOYEES),
      leaveRequests: this.loadData("leaveRequests", INITIAL_LEAVE_REQUESTS),
      expenses: this.loadData("expenses", INITIAL_EXPENSES),
      ledger: this.loadData("ledger", INITIAL_LEDGER),
      atelierJobs: this.loadData("atelierJobs", INITIAL_ATELIER_JOBS),
      securityLog: this.loadData("securityLog", INITIAL_SECURITY_LOG),
      permissions: this.loadData("permissions", INITIAL_PERMISSIONS),

      // Synchronisation hors-ligne
      syncQueue: [],
      
      // États temporaires
      selectedPatientId: null,
      basket: [],
      currentMonth: 5,
      currentYear: 2026
    };

    this.charts = {};
    this.inactivityTimer = null;
  }

  loadData(key, fallback) {
    const val = localStorage.getItem(`oculo_${key}`);
    if (val) {
      try {
        return JSON.parse(val);
      } catch (e) {
        console.error(e);
      }
    }
    return fallback;
  }

  saveData(key, data) {
    this.state[key] = data;
    localStorage.setItem(`oculo_${key}`, JSON.stringify(data));
  }

  init() {
    // 1. Initialiser le thème initial (Clair / Sombre / Auto)
    this.applyTheme();

    // 2. Initialiser l'état d'authentification
    this.checkAuthenticationState();

    // 3. Liaison de la détection d'inactivité
    this.initInactivityDetector();

    // 4. Traduction
    this.applyTranslations();

    // 5. Initialiser les sélecteurs
    this.initSelectors();

    // 6. Navigation
    this.initNavigation();

    // 7. Évènements
    this.initEventListeners();

    // 8. Rendu et graphiques
    this.renderCurrentView();
    this.renderCharts();
    this.initIASimulator();

    lucide.createIcons();
  }

  // Thème Clair / Sombre / Auto
  applyTheme() {
    const icon = document.getElementById("themeIcon");
    if (this.state.theme === "dark") {
      document.documentElement.className = "dark";
      if (icon) icon.setAttribute("data-lucide", "moon");
    } else if (this.state.theme === "light") {
      document.documentElement.className = "light";
      if (icon) icon.setAttribute("data-lucide", "sun");
    } else {
      // Auto
      const matches = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.className = matches ? "dark" : "light";
      if (icon) icon.setAttribute("data-lucide", "laptop");
    }
    lucide.createIcons();
  }

  checkAuthenticationState() {
    const authScreen = document.getElementById("authScreen");
    const mainLayout = document.getElementById("mainAppLayout");

    if (this.state.isLoggedIn) {
      authScreen.style.display = "none";
      mainLayout.style.display = "grid";
    } else {
      authScreen.style.display = "flex";
      mainLayout.style.display = "none";
    }
  }

  // Détection d'inactivité (Verrouillage de session)
  initInactivityDetector() {
    const resetTimer = () => {
      clearTimeout(this.inactivityTimer);
      if (this.state.isLoggedIn) {
        this.inactivityTimer = setTimeout(() => this.lockSession(), 600000);
      }
    };

    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click", resetTimer);
    resetTimer();
  }

  lockSession() {
    const lockScreen = document.getElementById("lockScreen");
    const emp = this.state.employees.find(e => e.role === this.state.selectedRole) || this.state.employees[0];
    
    document.getElementById("lockUserName").textContent = emp.name;
    document.getElementById("lockAvatar").textContent = emp.name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();
    document.getElementById("lockPasswordInput").value = "";

    lockScreen.style.display = "flex";
  }

  unlockSession() {
    document.getElementById("lockScreen").style.display = "none";
    this.addSecurityLog("Déverrouillage session", "Succès");
  }

  addSecurityLog(action, status) {
    const emp = this.state.employees.find(e => e.role === this.state.selectedRole) || { name: "Anonyme" };
    const log = {
      date: new Date().toISOString().replace('T', ' ').slice(0, 19),
      user: emp.name,
      action: action,
      ip: "197.34." + Math.floor(100 + Math.random()*150) + "." + Math.floor(10 + Math.random()*80),
      status: status
    };
    this.state.securityLog.unshift(log);
    this.saveData("securityLog", this.state.securityLog);
    if (this.state.activeTab === "dashboard") {
      this.renderDashboardActivities();
    }
  }

  applyTranslations() {
    const dict = translations[this.state.lang];
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (dict[key]) {
        el.setAttribute("placeholder", dict[key]);
      }
    });

    document.documentElement.lang = this.state.lang;
  }

  initSelectors() {
    // Sélecteur de devise
    const curSel = document.getElementById("currencySelector");
    curSel.value = this.state.currency;
    curSel.addEventListener("change", (e) => {
      this.state.currency = e.target.value;
      localStorage.setItem("oculo_currency", this.state.currency);
      this.renderCurrentView();
    });

    // Sélecteur de thème
    const themeSel = document.getElementById("themeSelector");
    themeSel.value = this.state.theme;
    themeSel.addEventListener("change", (e) => {
      this.state.theme = e.target.value;
      localStorage.setItem("oculo_theme", this.state.theme);
      this.applyTheme();
    });

    // Sélecteur de langue
    const langSel = document.getElementById("langSelector");
    langSel.value = this.state.lang;
    langSel.addEventListener("change", (e) => {
      this.state.lang = e.target.value;
      localStorage.setItem("oculo_lang", this.state.lang);
      this.applyTranslations();
      this.renderCurrentView();
    });

    // Rôles dans le sélecteur
    this.renderRoleSelectorOptions();
  }

  renderRoleSelectorOptions() {
    const roleSel = document.getElementById("roleSelector");
    roleSel.innerHTML = "";
    
    const rolesMap = {
      admin: "Super Administrateur",
      ophtalmo: "Dr. Diallo (Ophtalmologue)",
      opticien: "M. Traoré (Opticien)",
      receptionniste: "Mme Sow (Réceptionniste)",
      caissier: "M. N'Guessan (Caissier)",
      comptable: "Mme Cissé (Comptable)"
    };

    Object.keys(rolesMap).forEach(key => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = rolesMap[key];
      roleSel.appendChild(opt);
    });

    roleSel.value = this.state.selectedRole;
  }

  applyRoleRestrictions() {
    const role = this.state.selectedRole;
    const permissions = this.state.permissions[role] || { clinique: true, optique: true, atelier: true, caisse: true, rh: true, finance: true };

    const applyNavRestriction = (className, hasPermission) => {
      document.querySelectorAll(`.${className}`).forEach(el => {
        el.style.display = hasPermission ? "" : "none";
      });
    };

    applyNavRestriction("perm-clinique", permissions.clinique || permissions.admin);
    applyNavRestriction("perm-optique", permissions.optique || permissions.admin);
    applyNavRestriction("perm-atelier", permissions.atelier || permissions.admin);
    applyNavRestriction("perm-caisse", permissions.caisse || permissions.admin);
    applyNavRestriction("perm-rh", permissions.rh || permissions.admin);
    applyNavRestriction("perm-finance", permissions.finance || permissions.admin);

    const currentLink = document.querySelector(`.nav-link[data-tab="${this.state.activeTab}"]`);
    if (currentLink && currentLink.parentNode.style.display === "none") {
      this.switchTab("dashboard");
    }
  }

  initNavigation() {
    const navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const tab = link.getAttribute("data-tab");
        this.switchTab(tab);
      });
    });

    // Basculeur réseau offline/online
    const networkBtn = document.getElementById("toggleNetworkBtn");
    networkBtn.addEventListener("click", () => {
      this.state.isOnline = !this.state.isOnline;
      const syncStatus = document.getElementById("syncStatusBadge");
      const label = syncStatus.querySelector("span:nth-child(2)");
      
      if (this.state.isOnline) {
        syncStatus.classList.remove("offline");
        label.textContent = this.state.lang === "fr" ? "En ligne" : "Online";
        
        if (this.state.syncQueue.length > 0) {
          alert(`Synchronisation cloud réussie (${this.state.syncQueue.length} éléments sauvegardés).`);
          this.state.syncQueue = [];
        }
      } else {
        syncStatus.classList.add("offline");
        label.textContent = this.state.lang === "fr" ? "Hors-ligne" : "Offline";
      }
    });
  }

  switchTab(tab) {
    this.state.activeTab = tab;
    
    document.querySelectorAll(".nav-link").forEach(l => {
      if (l.getAttribute("data-tab") === tab) {
        l.classList.add("active");
      } else {
        l.classList.remove("active");
      }
    });

    document.querySelectorAll(".content-view").forEach(view => {
      view.classList.remove("active-view");
    });
    
    const targetView = document.getElementById(`view-${tab}`);
    if (targetView) {
      targetView.classList.add("active-view");
    }

    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.remove("mobile-open");

    this.renderCurrentView();
  }

  renderCurrentView() {
    this.applyRoleRestrictions();
    const tab = this.state.activeTab;

    if (tab === "dashboard") {
      this.renderDashboard();
    } else if (tab === "patients") {
      this.renderPatientsList();
      if (this.state.selectedPatientId) {
        this.renderPatientDossier(this.state.selectedPatientId);
      }
    } else if (tab === "consultations") {
      this.renderAllConsultations();
    } else if (tab === "optics") {
      this.renderStock();
    } else if (tab === "atelier") {
      this.renderAtelierJobs();
    } else if (tab === "caisse") {
      this.renderCaisse();
    } else if (tab === "rendezvous") {
      this.renderCalendar();
    } else if (tab === "chirurgies") {
      this.renderSurgeries();
    } else if (tab === "rh") {
      this.renderRH();
    } else if (tab === "finance") {
      this.renderFinance();
    } else if (tab === "parametres") {
      this.renderPermissionsMatrix();
    }

    lucide.createIcons();
  }

  // ==========================================
  // DASHBOARD
  // ==========================================
  renderDashboard() {
    const revEl = document.getElementById("dashboardRevenue");
    const consultEl = document.getElementById("dashboardConsultations");
    const stockAlertEl = document.getElementById("dashboardStockAlerts");
    const benefitEl = document.getElementById("dashboardBenefits");
    
    let baseRev = 8450000;
    let baseConsult = 342;
    let baseExpenses = 1200000;
    
    if (this.state.selectedClinic === "abidjan_cocody") {
      baseRev = 12900000;
      baseConsult = 412;
      baseExpenses = 2100000;
    } else if (this.state.selectedClinic === "optique_bamako") {
      baseRev = 4800000;
      baseConsult = 189;
      baseExpenses = 900000;
    } else if (this.state.selectedClinic === "lom_boutique") {
      baseRev = 3200000;
      baseConsult = 110;
      baseExpenses = 600000;
    }

    revEl.textContent = this.formatCurrency(baseRev);
    consultEl.textContent = baseConsult;
    benefitEl.textContent = this.formatCurrency(baseRev - baseExpenses);

    const alerts = this.state.stock.filter(item => item.qty <= item.minAlert);
    stockAlertEl.textContent = alerts.length;

    const apptsList = document.getElementById("dashboardAppointmentsList");
    apptsList.innerHTML = "";
    
    const todayAppts = this.state.appointments.filter(a => a.date === "2026-06-27");
    
    if (todayAppts.length === 0) {
      apptsList.innerHTML = `<li class="text-muted text-sm p-4 text-center">Aucun rendez-vous aujourd'hui</li>`;
    } else {
      todayAppts.forEach(a => {
        let typeClass = "event-consult";
        if (a.type === "chirurgie") typeClass = "event-surgery";
        if (a.type === "postop") typeClass = "event-postop";

        apptsList.innerHTML += `
          <li class="list-item-card">
            <div class="list-item-main">
              <span class="list-item-title">${a.patientName}</span>
              <span class="list-item-desc">${a.doctor} • <span class="badge ${typeClass}">${a.type.toUpperCase()}</span></span>
            </div>
            <div class="list-item-meta">
              <strong>${a.time}</strong>
            </div>
          </li>
        `;
      });
    }

    this.renderDashboardActivities();
    this.renderHeaderNotifications();
  }

  renderDashboardActivities() {
    const actBody = document.getElementById("dashboardActivityLogTable");
    actBody.innerHTML = "";
    this.state.securityLog.slice(0, 4).forEach(log => {
      const isSuccess = log.status === "Succès";
      actBody.innerHTML += `
        <tr>
          <td><span class="text-xs text-secondary">${log.date.split(" ")[1]}</span></td>
          <td><strong>${log.user}</strong></td>
          <td>${log.action}</td>
          <td><span class="dossier-id-badge">${log.ip}</span></td>
          <td><span class="badge ${isSuccess ? 'badge-cyan' : 'badge-red'}">${log.status}</span></td>
        </tr>
      `;
    });
  }

  // ==========================================
  // PATIENT FILES
  // ==========================================
  renderPatientsList() {
    const listBody = document.getElementById("patientListTableBody");
    const searchVal = document.getElementById("patientSearchInput").value.toLowerCase();
    const genderVal = document.getElementById("patientFilterGender").value;

    listBody.innerHTML = "";

    const filtered = this.state.patients.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchVal) || p.phone.includes(searchVal) || p.id.toLowerCase().includes(searchVal);
      const matchGender = genderVal === "all" || p.gender === genderVal;
      return matchSearch && matchGender;
    });

    if (filtered.length === 0) {
      listBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Aucun patient trouvé.</td></tr>`;
      return;
    }

    filtered.forEach(p => {
      const isActive = p.id === this.state.selectedPatientId ? "class='active-row'" : "";
      listBody.innerHTML += `
        <tr ${isActive} data-pat-row-id="${p.id}">
          <td><span class="dossier-id-badge">${p.id}</span></td>
          <td><strong>${p.name}</strong></td>
          <td>${this.calculateAge(p.birthDate)} ans • ${p.gender}</td>
          <td>${p.phone}</td>
          <td>${p.lastVisit}</td>
        </tr>
      `;
    });

    document.querySelectorAll("[data-pat-row-id]").forEach(row => {
      row.addEventListener("click", () => {
        const id = row.getAttribute("data-pat-row-id");
        this.selectPatient(id);
      });
    });
  }

  selectPatient(id) {
    this.state.selectedPatientId = id;
    this.renderPatientsList();
    this.renderPatientDossier(id);
  }

  renderPatientDossier(id) {
    const patient = this.state.patients.find(p => p.id === id);
    if (!patient) return;

    document.getElementById("patientDetailEmptyState").style.display = "none";
    const dossierContainer = document.getElementById("patientDossierContainer");
    dossierContainer.style.display = "block";

    document.getElementById("dossierName").textContent = patient.name;
    document.getElementById("dossierAgeGender").textContent = `${this.calculateAge(patient.birthDate)} ans • ${patient.gender === 'M' ? 'Homme' : 'Femme'}`;
    document.getElementById("dossierId").textContent = `N° ${patient.id}`;
    document.getElementById("dossierAvatar").textContent = patient.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

    document.getElementById("dossierPhone").textContent = patient.phone;
    document.getElementById("dossierEmail").textContent = patient.email || "-";
    document.getElementById("dossierAddress").textContent = patient.address || "-";
    document.getElementById("dossierProfession").textContent = patient.profession || "-";
    document.getElementById("dossierBloodGroup").textContent = patient.bloodGroup || "O+";
    document.getElementById("dossierInsurance").textContent = patient.insurance || "Aucune";
    document.getElementById("dossierNationalId").textContent = patient.nationalId || "-";

    const antContainer = document.getElementById("dossierAntecedents");
    antContainer.innerHTML = "";
    if (patient.antecedents && patient.antecedents.length > 0) {
      patient.antecedents.forEach(a => {
        let badgeColor = "";
        if (a.toLowerCase().includes("diabète") || a.toLowerCase().includes("hypertension")) {
          badgeColor = "badge-red";
        } else if (a.toLowerCase().includes("glaucome") || a.toLowerCase().includes("cataracte")) {
          badgeColor = "badge-orange";
        }
        antContainer.innerHTML += `<span class="badge ${badgeColor}">${a}</span>`;
      });
    } else {
      antContainer.innerHTML = `<span class="text-muted text-xs">Aucun antécédent médical connu</span>`;
    }

    document.getElementById("dossierNotes").textContent = patient.notes || "Aucune note générale.";

    const consultList = document.getElementById("dossierConsultationsList");
    consultList.innerHTML = "";
    const pConsults = this.state.consultations.filter(c => c.patientId === id);

    if (pConsults.length === 0) {
      consultList.innerHTML = `<div class="text-center text-muted text-sm p-4">Aucune consultation enregistrée pour ce patient.</div>`;
    } else {
      pConsults.forEach(c => {
        consultList.innerHTML += `
          <div class="consultation-summary-card">
            <div class="consult-card-header">
              <strong>${c.date}</strong>
              <span>Praticien : ${c.doctor}</span>
            </div>
            <div class="consult-card-diag text-accent-blue">${c.diagnostic}</div>
            
            <table class="refraction-preview-table mb-2">
              <thead>
                <tr>
                  <th>Œil</th>
                  <th>Sphère</th>
                  <th>Cylindre</th>
                  <th>Axe</th>
                  <th>Addition</th>
                  <th>Acuité Visuelle</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>OD</strong></td>
                  <td>${c.refraction.od.sph || "-"}</td>
                  <td>${c.refraction.od.cyl || "-"}</td>
                  <td>${c.refraction.od.axe || "-"}°</td>
                  <td>${c.refraction.od.add || "-"}</td>
                  <td>${c.refraction.od.av || "-"}</td>
                </tr>
                <tr>
                  <td><strong>OG</strong></td>
                  <td>${c.refraction.og.sph || "-"}</td>
                  <td>${c.refraction.og.cyl || "-"}</td>
                  <td>${c.refraction.og.axe || "-"}°</td>
                  <td>${c.refraction.og.add || "-"}</td>
                  <td>${c.refraction.og.av || "-"}</td>
                </tr>
              </tbody>
            </table>

            <div class="text-xs text-secondary mb-1">
              <strong>PIO :</strong> OD: ${c.tonometrie.od} | OG: ${c.tonometrie.og}
            </div>
            ${c.prescriptionMedicale ? `
              <div class="text-xs text-secondary">
                <strong>Ordonnance :</strong> ${c.prescriptionMedicale}
              </div>
            ` : ""}
            
            <div class="flex gap-2 mt-3">
              <button class="btn btn-outline btn-sm flex-center" onclick="app.viewInvoicePrescription('${c.id}', 'presc')">
                <i data-lucide="printer" class="mr-1" style="width:12px;height:12px;"></i>Imprimer Ordonnance
              </button>
            </div>
          </div>
        `;
      });
    }

    const examGrid = document.getElementById("dossierExamensGrid");
    examGrid.innerHTML = `
      <div class="exam-image-card">
        <div class="exam-img-placeholder">
          <svg viewBox="0 0 100 100" class="w-full h-full opacity-60">
            <circle cx="50" cy="50" r="40" fill="#2b0e00" stroke="#f97316" stroke-width="1"/>
            <path d="M50,10 C60,40 40,60 50,90" stroke="#ff3c00" stroke-width="1.5" fill="none"/>
            <circle cx="50" cy="50" r="8" fill="#ff7700" opacity="0.8"/>
          </svg>
        </div>
        <div class="exam-img-label">Fond d'œil Rétinographie</div>
        <div class="text-xs text-muted px-1">Enregistré le 15 Juin 2026</div>
      </div>
      <div class="exam-image-card">
        <div class="exam-img-placeholder">
          <svg viewBox="0 0 100 60" class="w-full h-full opacity-60">
            <rect width="100%" height="100%" fill="#050b14"/>
            <path d="M 0 30 Q 25 15, 50 30 T 100 30" fill="none" stroke="#0d6efd" stroke-width="2"/>
          </svg>
        </div>
        <div class="exam-img-label">OCT Coupe Maculaire</div>
        <div class="text-xs text-muted px-1">Enregistré le 15 Juin 2026</div>
      </div>
    `;

    const ordList = document.getElementById("dossierOrdonnancesList");
    ordList.innerHTML = "";
    const pTrans = this.state.transactions.filter(t => t.patientName === patient.name);

    pTrans.forEach(t => {
      ordList.innerHTML += `
        <div class="list-item-card">
          <div class="list-item-main">
            <span class="list-item-title">${t.items}</span>
            <span class="list-item-desc">${t.date} • Mode : <strong>${t.method.toUpperCase()}</strong></span>
          </div>
          <div class="list-item-meta flex-center gap-2">
            <strong class="text-accent-orange mr-2">${this.formatCurrency(t.amount)}</strong>
            <button class="btn btn-outline btn-sm" onclick="app.viewInvoicePrescription('${t.id}', 'invoice')">
              <i data-lucide="printer" style="width:12px;height:12px;"></i>
            </button>
          </div>
        </div>
      `;
    });

    lucide.createIcons();
  }

  // ==========================================
  // CONSULTATIONS
  // ==========================================
  renderAllConsultations() {
    const tableBody = document.getElementById("consultationsTableBody");
    const searchVal = document.getElementById("consultationSearchInput").value.toLowerCase();
    tableBody.innerHTML = "";

    const filtered = this.state.consultations.filter(c => {
      return c.patientName.toLowerCase().includes(searchVal) || c.doctor.toLowerCase().includes(searchVal) || c.diagnostic.toLowerCase().includes(searchVal);
    });

    filtered.forEach(c => {
      tableBody.innerHTML += `
        <tr>
          <td>${c.date}</td>
          <td><strong>${c.patientName}</strong></td>
          <td>${c.doctor}</td>
          <td>
            <span class="text-xs">OD: ${c.refraction.od.sph || "0"} (${c.refraction.od.cyl || "0"}) / OG: ${c.refraction.og.sph || "0"} (${c.refraction.og.cyl || "0"})</span>
          </td>
          <td><span class="text-accent-blue font-semibold">${c.diagnostic}</span></td>
          <td>
            <button class="btn btn-outline btn-sm flex-center" onclick="app.viewInvoicePrescription('${c.id}', 'presc')">
              <i data-lucide="printer" class="mr-1" style="width:12px;height:12px;"></i> Imprimer
            </button>
          </td>
        </tr>
      `;
    });
  }

  // ==========================================
  // STOCK OPTIQUE
  // ==========================================
  renderStock() {
    const framesBody = document.getElementById("monturesStockTableBody");
    const lensesBody = document.getElementById("verresStockTableBody");
    const searchVal = document.getElementById("stockSearchInput").value.toLowerCase();
    const filterAlert = document.getElementById("stockFilterAlerts").value === "alert";

    framesBody.innerHTML = "";
    lensesBody.innerHTML = "";

    const filtered = this.state.stock.filter(item => {
      const matchSearch = item.brand.toLowerCase().includes(searchVal) || item.model.toLowerCase().includes(searchVal) || item.ref.toLowerCase().includes(searchVal);
      const matchAlert = !filterAlert || (item.qty <= item.minAlert);
      return matchSearch && matchAlert;
    });

    filtered.forEach(item => {
      const isAlert = item.qty <= item.minAlert;
      if (item.type === "monture") {
        framesBody.innerHTML += `
          <tr class="${isAlert ? 'bg-red-alpha' : ''}">
            <td><span class="dossier-id-badge">${item.ref}</span></td>
            <td><strong>${item.brand}</strong></td>
            <td>${item.model}</td>
            <td>${this.formatCurrency(item.buyPrice)}</td>
            <td class="text-accent-orange font-semibold">${this.formatCurrency(item.sellPrice)}</td>
            <td class="${isAlert ? 'text-red font-bold' : ''}">${item.qty} pcs</td>
            <td>${item.minAlert} pcs</td>
            <td>
              <button class="btn btn-outline btn-sm btn-icon-only" onclick="app.adjustStockQty('${item.ref}', 1)"><i data-lucide="plus"></i></button>
              <button class="btn btn-outline btn-sm btn-icon-only" onclick="app.adjustStockQty('${item.ref}', -1)"><i data-lucide="minus"></i></button>
            </td>
          </tr>
        `;
      } else if (item.type === "verre") {
        lensesBody.innerHTML += `
          <tr class="${isAlert ? 'bg-red-alpha' : ''}">
            <td><strong>${item.brand}</strong></td>
            <td>${item.model.split(" ")[0]}</td>
            <td>${item.model.split(" ").slice(1,3).join(" ")}</td>
            <td>${item.model.split(" ").slice(3).join(" ") || "Standard"}</td>
            <td class="text-accent-blue font-semibold">${this.formatCurrency(item.sellPrice)}</td>
            <td class="${isAlert ? 'text-red font-bold' : ''}">${item.qty} pcs</td>
            <td>${item.minAlert} pcs</td>
            <td>
              <button class="btn btn-outline btn-sm btn-icon-only" onclick="app.adjustStockQty('${item.ref}', 1)"><i data-lucide="plus"></i></button>
              <button class="btn btn-outline btn-sm btn-icon-only" onclick="app.adjustStockQty('${item.ref}', -1)"><i data-lucide="minus"></i></button>
            </td>
          </tr>
        `;
      }
    });

    const suppliersBody = document.getElementById("suppliersTableBody");
    suppliersBody.innerHTML = `
      <tr>
        <td><strong>LentOptic RCI</strong></td>
        <td>+225 27 22 45 89 12</td>
        <td>Abidjan Cocody</td>
        <td>48 Heures</td>
      </tr>
      <tr>
        <td><strong>Dakar Optical Supply</strong></td>
        <td>+221 33 824 56 12</td>
        <td>Dakar Plateau</td>
        <td>24 Heures</td>
      </tr>
    `;

    const ordersBody = document.getElementById("ordersTableBody");
    ordersBody.innerHTML = `
      <tr>
        <td><span class="dossier-id-badge">CMD-2026-042</span></td>
        <td>Dakar Optical Supply</td>
        <td>15x Montures Ray-Ban</td>
        <td>25 Juin 2026</td>
        <td><span class="badge badge-orange">En Transit</span></td>
      </tr>
    `;
  }

  adjustStockQty(ref, diff) {
    const item = this.state.stock.find(i => i.ref === ref);
    if (!item) return;
    
    item.qty = Math.max(0, item.qty + diff);
    this.saveData("stock", this.state.stock);
    this.renderStock();
    this.renderDashboard();
  }

  // ==========================================
  // ATELIER DE MONTAGE [NEW]
  // ==========================================
  renderAtelierJobs() {
    const body = document.getElementById("atelierJobsTableBody");
    body.innerHTML = "";

    this.state.atelierJobs.forEach(job => {
      let badgeClass = "badge-orange";
      if (job.status === "Prêt pour livraison") badgeClass = "badge-cyan";

      body.innerHTML += `
        <tr>
          <td><span class="dossier-id-badge">${job.id}</span></td>
          <td><strong>${job.patientName}</strong></td>
          <td>${job.frame}</td>
          <td>${job.lens}</td>
          <td>${job.optician}</td>
          <td><span class="badge ${badgeClass}">${job.status}</span></td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="app.advanceAtelierJob('${job.id}')">Faire avancer</button>
          </td>
        </tr>
      `;
    });
  }

  advanceAtelierJob(id) {
    const job = this.state.atelierJobs.find(x => x.id === id);
    if (!job) return;

    if (job.status === "En cours de montage") {
      job.status = "Contrôle qualité";
    } else if (job.status === "Contrôle qualité") {
      job.status = "Prêt pour livraison";
    } else {
      job.status = "Livré";
      this.state.atelierJobs = this.state.atelierJobs.filter(x => x.id !== id);
    }
    
    this.saveData("atelierJobs", this.state.atelierJobs);
    this.renderAtelierJobs();
  }

  // ==========================================
  // CAISSE & POINT OF SALE
  // ==========================================
  renderCaisse() {
    const patSelect = document.getElementById("caissePatientSelect");
    patSelect.options.length = 1;
    this.state.patients.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.phone})`;
      patSelect.appendChild(opt);
    });

    if (this.state.selectedPatientId) {
      patSelect.value = this.state.selectedPatientId;
    }

    const label = document.getElementById("cashDrawerLabel");
    const dot = document.getElementById("cashDrawerDot");
    if (this.state.isCashDrawerOpen) {
      label.textContent = `Caisse ouverte - Solde: ${this.formatCurrency(this.state.cashDrawerAmount)}`;
      dot.className = "status-dot green";
    } else {
      label.textContent = "Caisse fermée";
      dot.className = "status-dot red";
    }

    this.renderPOSCatalog();
    this.renderBasket();
  }

  renderPOSCatalog() {
    const grid = document.getElementById("posCatalogGrid");
    grid.innerHTML = "";

    const activeFilterEl = document.querySelector("[data-pos-filter].active");
    const activeFilter = activeFilterEl ? activeFilterEl.getAttribute("data-pos-filter") : "all";

    const items = [
      ...this.state.stock.map(s => ({ id: s.ref, name: `${s.brand} ${s.model}`, price: s.sellPrice, type: s.type, stock: s.qty })),
      { id: "ACT-CONS", name: "Consultation simple ophtalmologie", price: 15000, type: "consult", stock: 999 },
      { id: "ACT-OCT", name: "Examen Imagerie OCT", price: 35000, type: "consult", stock: 999 }
    ];

    items.forEach(item => {
      if (activeFilter === "frames" && item.type !== "monture") return;
      if (activeFilter === "lenses" && item.type !== "verre") return;
      if (activeFilter === "consult" && item.type !== "consult") return;

      const isOut = item.stock === 0;
      const cardClass = isOut ? "opacity-50 style='pointer-events:none;'" : "";
      const iconClass = item.type === "consult" ? "blue-pos" : "";
      const iconName = item.type === "consult" ? "activity" : "glasses";
      
      grid.innerHTML += `
        <div class="pos-product-card" onclick="app.addToBasket('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.price})" ${cardClass}>
          <div class="product-card-icon ${iconClass}">
            <i data-lucide="${iconName}"></i>
          </div>
          <div class="product-name">${item.name}</div>
          <div class="product-price">${this.formatCurrency(item.price)}</div>
        </div>
      `;
    });

    lucide.createIcons();
  }

  addToBasket(id, name, price) {
    const existing = this.state.basket.find(x => x.id === id);
    if (existing) {
      existing.qty++;
    } else {
      this.state.basket.push({ id, name, price, qty: 1 });
    }
    this.renderBasket();
  }

  removeFromBasket(id) {
    this.state.basket = this.state.basket.filter(x => x.id !== id);
    this.renderBasket();
  }

  renderBasket() {
    const basketContainer = document.getElementById("basketItemsList");
    basketContainer.innerHTML = "";

    if (this.state.basket.length === 0) {
      basketContainer.innerHTML = `<div class="text-center text-muted text-sm p-6">Le panier est vide.</div>`;
      this.updateBasketTotals(0);
      return;
    }

    let subtotal = 0;
    this.state.basket.forEach(item => {
      subtotal += item.price * item.qty;
      basketContainer.innerHTML += `
        <div class="basket-item">
          <div class="basket-item-info">
            <span class="basket-item-name">${item.name}</span>
            <span class="basket-item-qty">Qté : ${item.qty} x ${this.formatCurrency(item.price)}</span>
          </div>
          <div class="basket-item-actions">
            <span class="basket-item-price">${this.formatCurrency(item.price * item.qty)}</span>
            <button class="btn-text text-red" onclick="app.removeFromBasket('${item.id}')"><i data-lucide="x" style="width:12px;height:12px;"></i></button>
          </div>
        </div>
      `;
    });

    this.updateBasketTotals(subtotal);
    lucide.createIcons();
  }

  updateBasketTotals(subtotal) {
    const insuranceSelect = document.getElementById("caissePatientSelect");
    const patient = this.state.patients.find(p => p.id === insuranceSelect.value);

    let insuranceRebate = 0;
    if (patient && patient.insurance) {
      if (patient.insurance.includes("80%")) insuranceRebate = subtotal * 0.8;
      else if (patient.insurance.includes("70%")) insuranceRebate = subtotal * 0.7;
      else if (patient.insurance.includes("90%")) insuranceRebate = subtotal * 0.9;
    }

    const tva = (subtotal - insuranceRebate) * 0.18;
    const total = subtotal - insuranceRebate + tva;

    document.getElementById("basketSubtotal").textContent = this.formatCurrency(subtotal);
    document.getElementById("basketInsurancePart").textContent = `- ${this.formatCurrency(insuranceRebate)}`;
    document.getElementById("basketTaxes").textContent = this.formatCurrency(tva);
    document.getElementById("basketTotal").textContent = this.formatCurrency(total);
  }

  // ==========================================
  // CALENDAR
  // ==========================================
  renderCalendar() {
    const calendarDays = document.getElementById("calendarDaysGrid");
    const weekdays = document.getElementById("calendarWeekdays");
    const label = document.getElementById("calendarMonthYearLabel");

    calendarDays.innerHTML = "";
    weekdays.innerHTML = "";

    const daysName = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    daysName.forEach(d => {
      weekdays.innerHTML += `<div>${d}</div>`;
    });

    label.textContent = "Juin 2026";

    for (let i = 1; i <= 35; i++) {
      const isOtherMonth = i > 30;
      const dayNum = isOtherMonth ? i - 30 : i;
      const dateStr = `2026-06-${dayNum.toString().padStart(2, '0')}`;
      
      const isToday = dayNum === 27 && !isOtherMonth ? "today" : "";
      const otherClass = isOtherMonth ? "other-month" : "";

      const dayEvents = this.state.appointments.filter(a => a.date === dateStr && !isOtherMonth);

      let eventsHtml = "";
      dayEvents.forEach(e => {
        let evClass = "event-consult";
        if (e.type === "chirurgie") evClass = "event-surgery";
        if (e.type === "postop") evClass = "event-postop";

        eventsHtml += `<div class="calendar-event ${evClass}" title="${e.patientName}">${e.patientName} (${e.time})</div>`;
      });

      calendarDays.innerHTML += `
        <div class="calendar-day-cell ${isToday} ${otherClass}">
          <span class="day-number">${dayNum}</span>
          <div class="calendar-day-events">${eventsHtml}</div>
        </div>
      `;
    }
  }

  // ==========================================
  // SURGERY PLANNING
  // ==========================================
  renderSurgeries() {
    const body = document.getElementById("surgeriesTableBody");
    body.innerHTML = "";

    this.state.surgeries.forEach(s => {
      const followUpsList = s.followUps.map(f => `<span class="badge badge-cyan" style="margin-right:2px;font-size:0.65rem;">${f}</span>`).join("");
      body.innerHTML += `
        <tr>
          <td><strong>${s.date}</strong></td>
          <td><strong>${s.patientName}</strong></td>
          <td>${s.doctor}</td>
          <td><span class="text-accent-blue">${s.type}</span></td>
          <td><strong>${s.eye}</strong></td>
          <td>${followUpsList}</td>
          <td><span class="badge badge-orange">${s.status}</span></td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="app.completeSurgery('${s.id}')">Marquer Fait</button>
          </td>
        </tr>
      `;
    });
  }

  completeSurgery(id) {
    const surg = this.state.surgeries.find(x => x.id === id);
    if (!surg) return;
    surg.status = "Terminé";
    this.saveData("surgeries", this.state.surgeries);
    this.renderSurgeries();
  }

  // ==========================================
  // HUMAN RESOURCES (RH) [NEW]
  // ==========================================
  renderRH() {
    const empBody = document.getElementById("rhEmployeesTableBody");
    empBody.innerHTML = "";
    this.state.employees.forEach(e => {
      const initials = e.name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();
      const mappedRole = e.role.charAt(0).toUpperCase() + e.role.slice(1);
      
      empBody.innerHTML += `
        <tr>
          <td>
            <div class="flex-center gap-2">
              <div class="user-avatar" style="width:28px;height:28px;font-size:0.75rem;">${initials}</div>
              <strong>${e.name}</strong>
            </div>
          </td>
          <td>${e.phone}<br><span class="text-xs text-muted">${e.email}</span></td>
          <td><span class="badge badge-cyan">${mappedRole}</span></td>
          <td>${e.branch === 'dakar_plateau' ? 'Dakar' : 'Abidjan'}</td>
          <td><strong>${this.formatCurrency(e.salary)}</strong></td>
          <td><span class="status-dot green"></span> ${e.status}</td>
          <td>
            <button class="btn btn-outline btn-sm text-red" onclick="app.fireEmployee('${e.id}')">Licencier</button>
          </td>
        </tr>
      `;
    });

    const leaveBody = document.getElementById("rhLeaveRequestsTableBody");
    leaveBody.innerHTML = "";
    this.state.leaveRequests.forEach(req => {
      const isPending = req.status === "En attente";
      leaveBody.innerHTML += `
        <tr>
          <td><strong>${req.employeeName}</strong></td>
          <td>Du ${req.start} au ${req.end}</td>
          <td>${req.type}</td>
          <td><span class="badge ${isPending ? 'badge-orange' : 'badge-cyan'}">${req.status}</span></td>
          <td>
            ${isPending ? `
              <div class="action-btn-group">
                <button class="btn btn-outline btn-sm text-green" onclick="app.approveLeave('${req.id}', 'Approuvé')">Accepter</button>
                <button class="btn btn-outline btn-sm text-red" onclick="app.approveLeave('${req.id}', 'Rejeté')">Refuser</button>
              </div>
            ` : "-"}
          </td>
        </tr>
      `;
    });

    const attBody = document.getElementById("rhAttendanceTableBody");
    attBody.innerHTML = "";
    this.state.employees.forEach(e => {
      attBody.innerHTML += `
        <tr>
          <td><strong>${e.name}</strong></td>
          <td>08:00</td>
          <td><span class="status-dot green"></span> Présent</td>
        </tr>
      `;
    });
  }

  fireEmployee(id) {
    this.state.employees = this.state.employees.filter(x => x.id !== id);
    this.saveData("employees", this.state.employees);
    this.renderRH();
  }

  approveLeave(id, status) {
    const req = this.state.leaveRequests.find(x => x.id === id);
    if (!req) return;
    req.status = status;
    this.saveData("leaveRequests", this.state.leaveRequests);
    this.renderRH();
  }

  // ==========================================
  // FINANCIAL REPORTS & EXPENSES [EXPANDED]
  // ==========================================
  renderFinance() {
    let totalOptic = 0;
    let totalClinic = 0;
    let totalMobile = 0;

    this.state.transactions.forEach(t => {
      if (t.items.includes("Consultation") || t.items.includes("Examen") || t.items.includes("Acte")) {
        totalClinic += t.amount;
      } else {
        totalOptic += t.amount;
      }

      if (t.method !== "cash" && t.method !== "card") {
        totalMobile += t.amount;
      }
    });

    const sumExpenses = this.state.expenses.reduce((acc, curr) => acc + curr.amount, 0);

    document.getElementById("finOpticRevenue").textContent = this.formatCurrency(5850000 + totalOptic);
    document.getElementById("finClinicRevenue").textContent = this.formatCurrency(2600000 + totalClinic);
    document.getElementById("finMobilePayment").textContent = this.formatCurrency(6150000 + totalMobile);
    document.getElementById("finExpenses").textContent = this.formatCurrency(sumExpenses);

    const receiptsBody = document.getElementById("financeReceiptsTableBody");
    receiptsBody.innerHTML = "";
    this.state.transactions.forEach(t => {
      const rest = t.status === "partiel" ? t.amount * 0.5 : 0;
      receiptsBody.innerHTML += `
        <tr>
          <td><span class="dossier-id-badge">${t.id}</span></td>
          <td>${t.date.split(" ")[0]}</td>
          <td><strong>${t.patientName}</strong></td>
          <td><span class="badge badge-cyan">${t.method.toUpperCase()}</span></td>
          <td><strong class="text-green">${this.formatCurrency(t.amount - rest)}</strong></td>
          <td><span class="text-red font-semibold">${rest > 0 ? this.formatCurrency(rest) : '-'}</span></td>
        </tr>
      `;
    });

    const expensesBody = document.getElementById("financeExpensesTableBody");
    expensesBody.innerHTML = "";
    this.state.expenses.forEach(exp => {
      expensesBody.innerHTML += `
        <tr>
          <td><span class="badge badge-orange">${exp.cat}</span></td>
          <td>${exp.date}</td>
          <td><strong>${exp.desc}</strong></td>
          <td><strong class="text-red">${this.formatCurrency(exp.amount)}</strong></td>
          <td>
            ${exp.hasFile ? `<span class="text-accent-blue cursor-pointer flex-center text-xs" onclick="alert('Justificatif scanné visible en haute résolution : ${exp.id}.jpg')"><i data-lucide="file" style="width:12px;height:12px;margin-right:2px;"></i> Justificatif</span>` : "Aucun"}
          </td>
          <td>
            <button class="btn-text text-red" onclick="app.deleteExpense('${exp.id}')">Supprimer</button>
          </td>
        </tr>
      `;
    });

    const ledgerBody = document.getElementById("financeLedgerTableBody");
    ledgerBody.innerHTML = "";
    this.state.ledger.forEach((entry, idx) => {
      ledgerBody.innerHTML += `
        <tr>
          <td><span class="dossier-id-badge">${entry.id || "LED-00" + (idx+1)}</span></td>
          <td><span class="text-xs text-secondary">${entry.date}</span></td>
          <td><strong>${entry.label}</strong></td>
          <td><span class="text-green">${entry.debit > 0 ? '+' + this.formatCurrency(entry.debit) : '-'}</span></td>
          <td><span class="text-red">${entry.credit > 0 ? '-' + this.formatCurrency(entry.credit) : '-'}</span></td>
          <td><strong>${this.formatCurrency(entry.balance)}</strong></td>
        </tr>
      `;
    });

    lucide.createIcons();
  }

  deleteExpense(id) {
    this.state.expenses = this.state.expenses.filter(x => x.id !== id);
    this.saveData("expenses", this.state.expenses);
    this.renderFinance();
  }

  // ==========================================
  // PARAMETRES & MATRICE DE ROLES
  // ==========================================
  renderPermissionsMatrix() {
    const body = document.getElementById("settingsRoleMatrixTableBody");
    body.innerHTML = "";

    Object.keys(this.state.permissions).forEach(role => {
      const p = this.state.permissions[role];
      const getCheck = (module, perm) => {
        return `<input type="checkbox" ${perm ? 'checked' : ''} onchange="app.togglePermission('${role}', '${module}', this.checked)">`;
      };

      body.innerHTML += `
        <tr>
          <td class="text-left"><strong>${role.toUpperCase()}</strong></td>
          <td>${getCheck('clinique', p.clinique)}</td>
          <td>${getCheck('optique', p.optique)}</td>
          <td>${getCheck('atelier', p.atelier)}</td>
          <td>${getCheck('caisse', p.caisse)}</td>
          <td>${getCheck('rh', p.rh)}</td>
          <td>${getCheck('finance', p.finance)}</td>
        </tr>
      `;
    });
  }

  togglePermission(role, module, isChecked) {
    this.state.permissions[role][module] = isChecked;
    this.saveData("permissions", this.state.permissions);
    this.applyRoleRestrictions();
  }

  // ==========================================
  // EVENEMENTS & MODALES & CONFIG
  // ==========================================
  initEventListeners() {
    const loginForm = document.getElementById("loginForm");
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      this.state.isLoggedIn = true;
      localStorage.setItem("oculo_isLoggedIn", "true");
      this.checkAuthenticationState();
      
      this.addSecurityLog("Connexion réussie", "Succès");
      this.renderCurrentView();
      this.renderCharts();
    });

    const logoutBtn = document.getElementById("logoutBtn");
    logoutBtn.addEventListener("click", () => {
      this.addSecurityLog("Déconnexion manuelle", "Succès");
      this.state.isLoggedIn = false;
      localStorage.setItem("oculo_isLoggedIn", "false");
      this.checkAuthenticationState();
    });

    const lockForm = document.getElementById("lockForm");
    lockForm.addEventListener("submit", (e) => {
      e.preventDefault();
      this.unlockSession();
    });

    document.getElementById("forgotPasswordBtn").addEventListener("click", () => {
      loginForm.style.display = "none";
      document.getElementById("forgotPasswordBlock").style.display = "block";
    });
    
    document.getElementById("backToLoginBtn").addEventListener("click", () => {
      loginForm.style.display = "block";
      document.getElementById("forgotPasswordBlock").style.display = "none";
    });

    document.getElementById("sendResetBtn").addEventListener("click", () => {
      const email = document.getElementById("resetEmailInput").value;
      if (!email) {
        alert("Veuillez saisir votre e-mail.");
        return;
      }
      alert("Lien de réinitialisation sécurisé envoyé à " + email);
      loginForm.style.display = "block";
      document.getElementById("forgotPasswordBlock").style.display = "none";
    });

    document.querySelectorAll("[data-rh-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        btn.parentNode.querySelectorAll("[data-rh-tab]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        document.querySelectorAll(".rh-pane").forEach(p => p.classList.remove("active"));
        document.getElementById(`rh-pane-${btn.getAttribute("data-rh-tab")}`).classList.add("active");
      });
    });

    document.querySelectorAll("[data-fin-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        btn.parentNode.querySelectorAll("[data-fin-tab]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        document.querySelectorAll(".fin-pane").forEach(p => p.classList.remove("active"));
        document.getElementById(`fin-pane-${btn.getAttribute("data-fin-tab")}`).classList.add("active");
      });
    });

    document.querySelectorAll("[data-settings-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        btn.parentNode.querySelectorAll("[data-settings-tab]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        document.querySelectorAll(".settings-pane").forEach(p => p.classList.remove("active"));
        document.getElementById(`settings-pane-${btn.getAttribute("data-settings-tab")}`).classList.add("active");
      });
    });

    document.getElementById("btnOpenCloseDrawer").addEventListener("click", () => {
      const txt = document.getElementById("cashDrawerInfoText");
      const label = document.getElementById("cashDrawerFieldLabel");
      const btn = document.getElementById("confirmCashDrawerBtn");

      if (this.state.isCashDrawerOpen) {
        label.textContent = "Confirmer le solde de fermeture réel de caisse *";
        txt.textContent = `Solde attendu calculé : ${this.formatCurrency(this.state.cashDrawerAmount)}. Saisissez le montant physique compté.`;
        btn.textContent = "Fermer la Caisse";
      } else {
        label.textContent = "Déclarer le fond de caisse initial *";
        txt.textContent = "Saisissez le montant en espèces présent dans le tiroir-caisse pour l'ouverture de la journée.";
        btn.textContent = "Ouvrir la Caisse";
      }
      this.openModal("cashDrawerModal");
    });

    const drawerForm = document.getElementById("cashDrawerForm");
    drawerForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const amt = parseFloat(document.getElementById("cashDrawerAmount").value);
      
      if (this.state.isCashDrawerOpen) {
        const diff = amt - this.state.cashDrawerAmount;
        if (diff !== 0) {
          alert(`Écart de caisse détecté ! Différence : ${this.formatCurrency(diff)}.`);
        } else {
          alert("Fermeture de caisse validée.");
        }
        
        const newLedg = {
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          label: "Fermeture journalière de Caisse",
          debit: 0,
          credit: this.state.cashDrawerAmount,
          balance: 0
        };
        this.state.ledger.push(newLedg);
        this.state.cashDrawerAmount = 0;
        this.state.isCashDrawerOpen = false;
      } else {
        this.state.cashDrawerAmount = amt;
        this.state.isCashDrawerOpen = true;
        
        const newLedg = {
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          label: "Ouverture journalière de Caisse",
          debit: amt,
          credit: 0,
          balance: amt
        };
        this.state.ledger.push(newLedg);
        alert(`Caisse ouverte avec un fond initial de ${this.formatCurrency(amt)}.`);
      }

      this.saveData("drawerOpen", this.state.isCashDrawerOpen);
      this.saveData("drawerAmount", this.state.cashDrawerAmount);
      this.saveData("ledger", this.state.ledger);
      
      drawerForm.reset();
      this.closeModal("cashDrawerModal");
      this.renderCaisse();
      this.renderFinance();
    });

    document.getElementById("closeCashDrawerModalBtn").addEventListener("click", () => this.closeModal("cashDrawerModal"));
    document.getElementById("cancelCashDrawerBtn").addEventListener("click", () => this.closeModal("cashDrawerModal"));

    this.bindModal("openAddEmployeeModalBtn", "closeAddEmployeeModalBtn", "addEmployeeModal");
    const empForm = document.getElementById("addEmployeeForm");
    empForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const newEmp = {
        id: `EMP-0${this.state.employees.length + 1}`,
        name: document.getElementById("empName").value,
        phone: document.getElementById("empPhone").value,
        email: document.getElementById("empEmail").value,
        role: document.getElementById("empRole").value,
        salary: parseFloat(document.getElementById("empSalary").value),
        status: "Actif",
        branch: document.getElementById("empBranch").value
      };

      this.state.employees.push(newEmp);
      this.saveData("employees", this.state.employees);
      
      empForm.reset();
      this.closeModal("addEmployeeModal");
      this.renderRH();
    });
    document.getElementById("cancelEmployeeBtn").addEventListener("click", () => this.closeModal("addEmployeeModal"));

    this.bindModal("openAddExpenseBtn", "closeAddExpenseModalBtn", "addExpenseModal");
    const expForm = document.getElementById("addExpenseForm");
    expForm.addEventListener("submit", (e) => {
      e.preventDefault();
      
      const newExp = {
        id: `EXP-00${this.state.expenses.length + 1}`,
        cat: document.getElementById("expCat").value,
        date: new Date().toISOString().slice(0, 10),
        desc: document.getElementById("expDesc").value,
        amount: parseFloat(document.getElementById("expAmount").value),
        hasFile: true
      };

      this.state.expenses.push(newExp);
      this.saveData("expenses", this.state.expenses);

      const newLedg = {
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
        label: `Dépense : ${newExp.cat} - ${newExp.desc}`,
        debit: 0,
        credit: newExp.amount,
        balance: this.state.cashDrawerAmount - newExp.amount
      };
      this.state.ledger.push(newLedg);
      this.state.cashDrawerAmount -= newExp.amount;
      this.saveData("drawerAmount", this.state.cashDrawerAmount);
      this.saveData("ledger", this.state.ledger);

      expForm.reset();
      this.closeModal("addExpenseModal");
      this.renderFinance();
      this.renderCaisse();
    });
    document.getElementById("cancelExpenseBtn").addEventListener("click", () => this.closeModal("addExpenseModal"));

    this.bindModal("openAddRoleModalBtn", "closeAddRoleModalBtn", "addRoleModal");
    const roleForm = document.getElementById("addRoleForm");
    roleForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = document.getElementById("customRoleName").value;
      const formatted = val.toLowerCase().replace(/\s/g, "_");
      
      this.state.permissions[formatted] = { clinique: false, optique: false, atelier: false, caisse: false, rh: false, finance: false };
      this.saveData("permissions", this.state.permissions);
      
      const roleSel = document.getElementById("roleSelector");
      const opt = document.createElement("option");
      opt.value = formatted;
      opt.textContent = val;
      roleSel.appendChild(opt);

      roleForm.reset();
      this.closeModal("addRoleModal");
      this.renderPermissionsMatrix();
    });
    document.getElementById("cancelRoleBtn").addEventListener("click", () => this.closeModal("addRoleModal"));

    const partCheckbox = document.getElementById("caissePartialPayCheckbox");
    const partAmountInput = document.getElementById("caissePartialPayAmount");
    partCheckbox.addEventListener("change", () => {
      partAmountInput.style.display = partCheckbox.checked ? "inline-block" : "none";
    });

    const roleSel = document.getElementById("roleSelector");
    roleSel.addEventListener("change", (e) => {
      this.state.selectedRole = e.target.value;
      localStorage.setItem("oculo_role", this.state.selectedRole);
      
      const nameLabel = document.getElementById("userNameLabel");
      const roleLabel = document.getElementById("userRoleLabel");
      const avatarLetter = document.getElementById("avatarLetter");
      
      const emp = this.state.employees.find(x => x.role === e.target.value) || { name: e.target.value.toUpperCase() };
      nameLabel.textContent = emp.name;
      roleLabel.textContent = e.target.options[e.target.selectedIndex].text.split(" (")[0];
      avatarLetter.textContent = emp.name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();

      this.applyRoleRestrictions();
      this.renderCurrentView();
    });

    const cpForm = document.getElementById("cinetpayConfigForm");
    if (cpForm) {
      cpForm.addEventListener("submit", (e) => {
        e.preventDefault();
        alert("Configuration de la passerelle marchande CinetPay mise à jour.");
      });
    }

    this.bindModal("openAddPatientModalBtn", "closeAddPatientModalBtn", "addPatientModal");
    
    const btnNewConsult = document.getElementById("dossierNewConsultationBtn");
    if (btnNewConsult) {
      btnNewConsult.addEventListener("click", () => {
        if (!this.state.selectedPatientId) return;
        document.getElementById("consultationPatientId").value = this.state.selectedPatientId;
        this.openModal("consultationModal");
      });
    }
    document.getElementById("closeConsultationModalBtn").addEventListener("click", () => this.closeModal("consultationModal"));
    document.getElementById("cancelConsultationBtn").addEventListener("click", () => this.closeModal("consultationModal"));

    const addPatForm = document.getElementById("addPatientForm");
    addPatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const newPat = {
        id: `PAT-2026-00${this.state.patients.length + 1}`,
        name: document.getElementById("patName").value,
        phone: document.getElementById("patPhone").value,
        birthDate: document.getElementById("patBirth").value,
        gender: document.getElementById("patGender").value,
        email: document.getElementById("patEmail").value,
        profession: document.getElementById("patProfession").value,
        address: document.getElementById("patAddress").value,
        insurance: document.getElementById("patInsurance").value,
        nationalId: document.getElementById("patNationalId").value,
        antecedents: document.getElementById("patAntecedents").value.split(",").map(x => x.trim()).filter(Boolean),
        notes: document.getElementById("patNotes").value,
        lastVisit: "2026-06-27"
      };

      this.state.patients.push(newPat);
      this.saveData("patients", this.state.patients);
      
      if (!this.state.isOnline) {
        this.state.syncQueue.push({ type: "patient", data: newPat });
      }

      addPatForm.reset();
      this.closeModal("addPatientModal");
      
      this.renderPatientsList();
      this.selectPatient(newPat.id);
    });

    const consultForm = document.getElementById("consultationForm");
    consultForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const patId = document.getElementById("consultationPatientId").value;
      const patient = this.state.patients.find(x => x.id === patId);
      if (!patient) return;

      const newConsult = {
        id: `CNS-00${this.state.consultations.length + 1}`,
        patientId: patId,
        patientName: patient.name,
        doctor: this.state.selectedRole === "ophtalmo" ? "Dr. Diallo" : "M. Traoré",
        date: "2026-06-27",
        refraction: {
          od: {
            sph: document.getElementById("refSphOD").value,
            cyl: document.getElementById("refCylOD").value,
            axe: document.getElementById("refAxeOD").value,
            add: document.getElementById("refAddOD").value,
            av: document.getElementById("refAvOD").value
          },
          og: {
            sph: document.getElementById("refSphOG").value,
            cyl: document.getElementById("refCylOG").value,
            axe: document.getElementById("refAxeOG").value,
            add: document.getElementById("refAddOG").value,
            av: document.getElementById("refAvOG").value
          }
        },
        tonometrie: {
          od: document.getElementById("tonometrieOD").value || "14 mmHg",
          og: document.getElementById("tonometrieOG").value || "14 mmHg"
        },
        biomicroscopie: document.getElementById("biomicroscopie").value,
        fondOeil: document.getElementById("fondOeil").value,
        diagnostic: document.getElementById("diagFinal").value,
        prescriptionMedicale: document.getElementById("prescMedical").value
      };

      this.state.consultations.push(newConsult);
      this.saveData("consultations", this.state.consultations);

      patient.lastVisit = "2026-06-27";
      this.saveData("patients", this.state.patients);

      const verreType = document.getElementById("prescVerreType").value;
      if (verreType !== "aucun") {
        const newJob = {
          id: `JOB-00${this.state.atelierJobs.length + 1}`,
          patientName: patient.name,
          frame: "A sélectionner",
          lens: `Verre ${verreType.toUpperCase()} + ${document.getElementById("prescVerreTreatment").value}`,
          optician: "M. Traoré",
          status: "En cours de montage"
        };
        this.state.atelierJobs.push(newJob);
        this.saveData("atelierJobs", this.state.atelierJobs);
      }

      consultForm.reset();
      document.getElementById("iaScanVisualizer").style.display = "none";
      this.closeModal("consultationModal");

      this.renderPatientsList();
      this.selectPatient(patId);
    });

    const apptForm = document.getElementById("addApptForm");
    const apptPatSelect = document.getElementById("apptPatient");
    document.getElementById("openAddApptModalBtn").addEventListener("click", () => {
      apptPatSelect.innerHTML = "";
      this.state.patients.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        apptPatSelect.appendChild(opt);
      });
    });

    apptForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const pId = apptPatSelect.value;
      const p = this.state.patients.find(x => x.id === pId);

      const newAppt = {
        id: `APT-00${this.state.appointments.length + 1}`,
        patientId: pId,
        patientName: p ? p.name : "Inconnu",
        date: document.getElementById("apptDate").value,
        time: document.getElementById("apptTime").value,
        type: document.getElementById("apptType").value,
        doctor: document.getElementById("apptDoctor").value,
        notes: document.getElementById("apptNotes").value,
        status: "confirmé"
      };

      this.state.appointments.push(newAppt);
      this.saveData("appointments", this.state.appointments);

      apptForm.reset();
      this.closeModal("addApptModal");
      this.renderCalendar();
      this.renderDashboard();
    });

    const stockForm = document.getElementById("addStockForm");
    stockForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const newStock = {
        ref: document.getElementById("stRef").value,
        type: document.getElementById("stType").value,
        brand: document.getElementById("stBrand").value,
        model: document.getElementById("stModel").value,
        buyPrice: parseFloat(document.getElementById("stPriceBuy").value),
        sellPrice: parseFloat(document.getElementById("stPriceSell").value),
        qty: parseInt(document.getElementById("stQty").value),
        minAlert: parseInt(document.getElementById("stMinAlert").value)
      };

      this.state.stock.push(newStock);
      this.saveData("stock", this.state.stock);

      stockForm.reset();
      this.closeModal("addStockModal");
      this.renderStock();
      this.renderDashboard();
    });

    const surgForm = document.getElementById("addSurgeryForm");
    const surgPatSelect = document.getElementById("surgPatient");
    document.getElementById("openAddSurgeryModalBtn").addEventListener("click", () => {
      surgPatSelect.innerHTML = "";
      this.state.patients.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        surgPatSelect.appendChild(opt);
      });
    });

    surgForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const pId = surgPatSelect.value;
      const p = this.state.patients.find(x => x.id === pId);

      const newSurg = {
        id: `SURG-00${this.state.surgeries.length + 1}`,
        patientId: pId,
        patientName: p ? p.name : "Patient",
        doctor: document.getElementById("surgDoctor").value,
        type: document.getElementById("surgType").value,
        eye: document.getElementById("surgEye").value,
        date: document.getElementById("surgDate").value,
        notes: document.getElementById("surgNotes").value,
        followUps: ["J+1", "J+7", "J+30"],
        status: "Planifié"
      };

      this.state.surgeries.push(newSurg);
      this.saveData("surgeries", this.state.surgeries);

      surgForm.reset();
      this.closeModal("addSurgeryModal");
      this.renderSurgeries();
    });

    document.getElementById("patientSearchInput").addEventListener("input", () => this.renderPatientsList());
    document.getElementById("patientFilterGender").addEventListener("change", () => this.renderPatientsList());
    document.getElementById("consultationSearchInput").addEventListener("input", () => this.renderAllConsultations());
    document.getElementById("stockSearchInput").addEventListener("input", () => this.renderStock());
    document.getElementById("stockFilterAlerts").addEventListener("change", () => this.renderStock());

    document.querySelectorAll("[data-pos-filter]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-pos-filter]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.renderPOSCatalog();
      });
    });

    document.getElementById("caissePatientSelect").addEventListener("change", () => this.renderBasket());
    document.getElementById("clearBasketBtn").addEventListener("click", () => {
      this.state.basket = [];
      this.renderBasket();
    });

    document.getElementById("btnProcessPayment").addEventListener("click", () => {
      if (this.state.basket.length === 0) {
        alert("Le panier est vide !");
        return;
      }
      if (!this.state.isOnline) {
        alert("L'application est hors-ligne. Synchronisation locale programmée.");
      }
      if (!this.state.isCashDrawerOpen) {
        alert("La caisse est fermée.");
        return;
      }
      this.openPaymentSimulator();
    });

    document.getElementById("btnSaveQuote").addEventListener("click", () => {
      if (this.state.basket.length === 0) {
        alert("Le panier est vide !");
        return;
      }
      this.viewInvoicePrescription("devis-" + Math.floor(Math.random()*1000), "quote");
    });

    document.getElementById("confirmMobilePaymentBtn").addEventListener("click", () => {
      const codeInput = document.getElementById("mobileValidationCode");
      if (codeInput.value.length < 6) {
        alert("Veuillez saisir un code à 6 chiffres.");
        return;
      }
      this.processPaymentSuccess();
    });
    
    document.getElementById("closeMobilePaymentModalBtn").addEventListener("click", () => this.closeModal("mobilePaymentModal"));
    document.getElementById("cancelMobilePaymentBtn").addEventListener("click", () => this.closeModal("mobilePaymentModal"));

    document.getElementById("closeInvoiceViewerModalBtn").addEventListener("click", () => this.closeModal("invoiceViewerModal"));
    document.getElementById("closeInvoiceViewerBtn").addEventListener("click", () => this.closeModal("invoiceViewerModal"));
    
    document.getElementById("printDocumentBtn").addEventListener("click", () => window.print());

    const bell = document.getElementById("notificationTrigger");
    const notifDrop = document.getElementById("notifDropdown");
    bell.addEventListener("click", (e) => {
      e.stopPropagation();
      notifDrop.classList.toggle("show");
    });
    document.addEventListener("click", () => notifDrop.classList.remove("show"));

    document.getElementById("markAllReadBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById("unreadNotifCount").textContent = "0";
      document.querySelectorAll(".notif-item").forEach(item => item.classList.remove("unread"));
    });

    const backupBtn = document.getElementById("triggerBackupBtn");
    if (backupBtn) {
      backupBtn.addEventListener("click", () => {
        backupBtn.innerHTML = `<i data-lucide="loader" class="mr-2 animate-spin"></i> Synchronisation...`;
        lucide.createIcons();
        setTimeout(() => {
          backupBtn.innerHTML = `<i data-lucide="refresh-cw" class="mr-2 animate-spin-hover"></i> Lancer une sauvegarde manuelle`;
          document.getElementById("lastBackupLabel").textContent = "À l'instant";
          alert("Sauvegarde cryptée et synchronisée avec succès vers le cloud souverain d'Afrique de l'Ouest !");
          lucide.createIcons();
        }, 1500);
      });
    }

    document.getElementById("clinicSelector").addEventListener("change", (e) => {
      this.state.selectedClinic = e.target.value;
      localStorage.setItem("oculo_clinic", this.state.selectedClinic);
      const locText = document.getElementById("currentLocationText");
      locText.textContent = e.target.options[e.target.selectedIndex].text.replace("Clinique ", "").replace("Optique ", "").replace("Optic-", "");
      this.renderCurrentView();
    });
  }

  bindModal(btnId, closeId, modalId) {
    const btn = document.getElementById(btnId);
    const close = document.getElementById(closeId);
    const modal = document.getElementById(modalId);
    
    if (btn && close && modal) {
      btn.addEventListener("click", () => this.openModal(modalId));
      close.addEventListener("click", () => this.closeModal(modalId));
    }
  }

  openModal(modalId) {
    document.getElementById(modalId).classList.add("show");
  }

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove("show");
  }

  // ==========================================
  // CINETPAY / MOBILE MONEY PAYMENT
  // ==========================================
  openPaymentSimulator() {
    const methodEl = document.querySelector('input[name="paymentMethod"]:checked');
    const provider = methodEl ? methodEl.value : "cash";

    let totalText = document.getElementById("basketTotal").textContent;
    let cleanAmount = parseFloat(totalText.replace(/\s/g, '').replace(/[A-Z]/g, ''));

    const partCheckbox = document.getElementById("caissePartialPayCheckbox");
    if (partCheckbox.checked) {
      const partVal = parseFloat(document.getElementById("caissePartialPayAmount").value);
      if (partVal > 0 && partVal < cleanAmount) {
        cleanAmount = partVal;
        totalText = this.formatCurrency(partVal);
      }
    }

    document.getElementById("paymentAmountBadge").textContent = totalText;

    const qrWrapper = document.getElementById("qrCodeWrapper");
    const instEl = document.getElementById("paymentInstructions");
    const titleEl = document.getElementById("mobilePaymentTitle");

    if (provider === "cash" || provider === "card") {
      this.processPaymentSuccess();
      return;
    }

    this.openModal("mobilePaymentModal");
    document.getElementById("mobileValidationCode").value = "";

    let codeUSSD = "*144*4*2*Montant#";
    let qrSvg = "";

    if (provider === "wave") {
      titleEl.textContent = "CinetPay - Wave Money";
      codeUSSD = "Scannez le QR Code Wave via votre application mobile.";
      qrSvg = this.generateDemoQR("#00a2e8");
    } else if (provider === "orange") {
      titleEl.textContent = "CinetPay - Orange Money";
      codeUSSD = "USSD : *144*39*Montant# (Code Marchand CinetPay)";
      qrSvg = this.generateDemoQR("#ff6600");
    } else if (provider === "mtn") {
      titleEl.textContent = "CinetPay - MTN MoMo";
      codeUSSD = "USSD : *133*ID_Marchand*Montant#";
      qrSvg = this.generateDemoQR("#ffbc00");
    } else if (provider === "moov") {
      titleEl.textContent = "CinetPay - Moov Money";
      codeUSSD = "USSD : *155*4*1*Montant#";
      qrSvg = this.generateDemoQR("#006633");
    } else if (provider === "free") {
      titleEl.textContent = "CinetPay - Free Money";
      codeUSSD = "USSD : *150*4*2*Montant# (Sénégal)";
      qrSvg = this.generateDemoQR("#ef4444");
    }

    instEl.innerHTML = `<strong>${codeUSSD}</strong>`;
    qrWrapper.innerHTML = qrSvg;
  }

  generateDemoQR(color) {
    return `
      <svg viewBox="0 0 100 100" width="130" height="130">
        <rect x="5" y="5" width="25" height="25" fill="none" stroke="${color}" stroke-width="4"/>
        <rect x="10" y="10" width="15" height="15" fill="${color}"/>
        <rect x="70" y="5" width="25" height="25" fill="none" stroke="${color}" stroke-width="4"/>
        <rect x="75" y="10" width="15" height="15" fill="${color}"/>
        <rect x="5" y="70" width="25" height="25" fill="none" stroke="${color}" stroke-width="4"/>
        <rect x="10" y="75" width="15" height="15" fill="${color}"/>
        <rect x="35" y="35" width="15" height="15" fill="${color}"/>
        <rect x="75" y="75" width="15" height="15" fill="${color}"/>
      </svg>
    `;
  }

  processPaymentSuccess() {
    this.closeModal("mobilePaymentModal");

    const methodEl = document.querySelector('input[name="paymentMethod"]:checked');
    const provider = methodEl ? methodEl.value : "cash";
    
    const patSelect = document.getElementById("caissePatientSelect");
    const patId = patSelect.value;
    const patient = this.state.patients.find(x => x.id === patId);
    const patName = patient ? patient.name : "Passage anonyme";

    const itemsSold = this.state.basket.map(x => `${x.qty}x ${x.name}`).join(", ");
    
    const totalText = document.getElementById("basketTotal").textContent;
    const basketTotal = parseFloat(totalText.replace(/\s/g, '').replace(/[A-Z]/g, ''));
    
    let paidAmount = basketTotal;
    let status = "succès";
    
    const partCheckbox = document.getElementById("caissePartialPayCheckbox");
    if (partCheckbox.checked) {
      const partVal = parseFloat(document.getElementById("caissePartialPayAmount").value);
      if (partVal > 0 && partVal < basketTotal) {
        paidAmount = partVal;
        status = "partiel";
      }
    }

    const txId = `CP-${Math.floor(1000 + Math.random()*9000)}-${provider.toUpperCase()}`;
    const newTx = {
      id: txId,
      date: "2026-06-27 13:42",
      patientName: patName,
      items: itemsSold,
      method: provider,
      amount: basketTotal,
      status: status
    };

    this.state.transactions.unshift(newTx);
    this.saveData("transactions", this.state.transactions);

    this.state.basket.forEach(item => {
      const stockItem = this.state.stock.find(s => s.ref === item.id);
      if (stockItem) {
        stockItem.qty = Math.max(0, stockItem.qty - item.qty);
      }
    });
    this.saveData("stock", this.state.stock);

    const newLedg = {
      date: "2026-06-27 13:42",
      label: `Recette CinetPay - Vente : ${itemsSold}`,
      debit: paidAmount,
      credit: 0,
      balance: this.state.cashDrawerAmount + paidAmount
    };
    this.state.ledger.push(newLedg);
    this.state.cashDrawerAmount += paidAmount;
    
    this.saveData("drawerAmount", this.state.cashDrawerAmount);
    this.saveData("ledger", this.state.ledger);

    const hasFrame = this.state.basket.some(x => x.id.startsWith("MT-"));
    const hasLens = this.state.basket.some(x => x.id.startsWith("VR-"));
    if (hasFrame && hasLens) {
      const newJob = {
        id: `JOB-00${this.state.atelierJobs.length + 1}`,
        patientName: patName,
        frame: this.state.basket.find(x => x.id.startsWith("MT-")).name,
        lens: this.state.basket.find(x => x.id.startsWith("VR-")).name,
        optician: "M. Traoré",
        status: "En cours de montage"
      };
      this.state.atelierJobs.unshift(newJob);
      this.saveData("atelierJobs", this.state.atelierJobs);
    }

    this.state.basket = [];
    this.renderBasket();
    this.renderCurrentView();

    this.viewInvoicePrescription(txId, "invoice");
  }

  // ==========================================
  // EXPORTS & DOCUMENT VIEWER (PRINT)
  // ==========================================
  viewInvoicePrescription(docId, type) {
    const printableArea = document.getElementById("printableInvoiceArea");
    const modalTitle = document.getElementById("invoiceViewerTitle");

    let htmlContent = "";
    const dateStr = "27 Juin 2026";

    if (type === "invoice") {
      modalTitle.textContent = "Reçu CinetPay Officiel";
      const tx = this.state.transactions.find(t => t.id === docId) || {
        id: docId,
        date: dateStr,
        patientName: "Passage anonyme",
        items: "Achat optique",
        method: "wave",
        amount: 65000,
        status: "succès"
      };

      const clinicName = this.state.selectedClinic === "dakar_plateau" ? "Clinique Dakar - Plateau" : "Clinique Abidjan - Cocody";
      const subtotal = tx.amount / 1.18;
      const tva = tx.amount - subtotal;
      const rest = tx.status === "partiel" ? tx.amount * 0.5 : 0;

      htmlContent = `
        <div class="print-header">
          <div>
            <span class="print-logo-text" style="color:var(--accent-blue);">OculoSaaS</span>
            <div class="print-clinic-details">${clinicName} • Afrique de l'Ouest</div>
          </div>
          <div class="print-doc-meta">
            <h2 style="color:var(--accent-blue);">FACTURE</h2>
            <strong>Réf CinetPay : ${tx.id}</strong><br>
            Date : ${tx.date}
          </div>
        </div>

        <div class="print-client-card">
          <div>
            <h4>CLIENT</h4>
            <strong>${tx.patientName}</strong>
          </div>
          <div>
            <h4>RÈGLEMENT CINETPAY</h4>
            Mode : <strong>${tx.method.toUpperCase()}</strong><br>
            Statut : <strong>${tx.status.toUpperCase()}</strong>
          </div>
        </div>

        <table class="print-table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align:right;">Total HT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${tx.items}</td>
              <td style="text-align:right;">${this.formatCurrency(subtotal)}</td>
            </tr>
          </tbody>
        </table>

        <div class="print-totals">
          <div class="print-totals-row">
            <span>Sous-total HT</span>
            <span>${this.formatCurrency(subtotal)}</span>
          </div>
          <div class="print-totals-row">
            <span>TVA (18%)</span>
            <span>${this.formatCurrency(tva)}</span>
          </div>
          <div class="print-totals-row final">
            <span>NET À PAYER</span>
            <span>${this.formatCurrency(tx.amount)}</span>
          </div>
          <div class="print-totals-row">
            <span>Montant Payé</span>
            <span style="color:green;font-weight:700;">${this.formatCurrency(tx.amount - rest)}</span>
          </div>
          ${rest > 0 ? `
            <div class="print-totals-row">
              <span style="color:red;font-weight:700;">Reste Dû</span>
              <span style="color:red;font-weight:700;">${this.formatCurrency(rest)}</span>
            </div>
          ` : ""}
        </div>
      `;
    } else if (type === "presc") {
      modalTitle.textContent = "Ordonnance Médicale & Réfractive";
      const consult = this.state.consultations.find(c => c.id === docId) || this.state.consultations[0];
      const patient = this.state.patients.find(p => p.id === consult.patientId) || this.state.patients[0];

      htmlContent = `
        <div class="print-header">
          <div>
            <span class="print-logo-text" style="color:var(--accent-blue);">Dr. Amadou Diallo</span>
            <div class="print-clinic-details">Ophtalmologiste • Dakar Plateau</div>
          </div>
          <div class="print-doc-meta">
            <h2 style="color:var(--accent-blue);">ORDONNANCE</h2>
            N° ORD-${consult.id}
          </div>
        </div>

        <div class="print-client-card" style="grid-template-columns:1fr;">
          <div>
            <h4>PATIENT</h4>
            <strong>M./Mme : ${patient.name}</strong> • Âge : ${this.calculateAge(patient.birthDate)} ans
          </div>
        </div>

        <div class="mb-4">
          <h4 style="color:var(--accent-blue);margin-bottom:0.5rem;">Prescription Réfractive</h4>
          <table class="refraction-preview-table" style="width:100%;border-collapse:collapse;color:#111;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="border:1px solid #333;padding:0.25rem;">Œil</th>
                <th style="border:1px solid #333;padding:0.25rem;">Sphère</th>
                <th style="border:1px solid #333;padding:0.25rem;">Cylindre</th>
                <th style="border:1px solid #333;padding:0.25rem;">Axe</th>
                <th style="border:1px solid #333;padding:0.25rem;">Addition</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border:1px solid #333;padding:0.25rem;font-weight:700;">OD</td>
                <td style="border:1px solid #333;padding:0.25rem;">${consult.refraction.od.sph}</td>
                <td style="border:1px solid #333;padding:0.25rem;">${consult.refraction.od.cyl}</td>
                <td style="border:1px solid #333;padding:0.25rem;">${consult.refraction.od.axe}°</td>
                <td style="border:1px solid #333;padding:0.25rem;">${consult.refraction.od.add}</td>
              </tr>
              <tr>
                <td style="border:1px solid #333;padding:0.25rem;font-weight:700;">OG</td>
                <td style="border:1px solid #333;padding:0.25rem;">${consult.refraction.og.sph}</td>
                <td style="border:1px solid #333;padding:0.25rem;">${consult.refraction.og.cyl}</td>
                <td style="border:1px solid #333;padding:0.25rem;">${consult.refraction.og.axe}°</td>
                <td style="border:1px solid #333;padding:0.25rem;">${consult.refraction.og.add}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mb-4">
          <h4 style="color:var(--accent-blue);margin-bottom:0.5rem;">Traitement Ophtalmique</h4>
          <p style="white-space:pre-line;font-family:monospace;">${consult.prescriptionMedicale || 'Pas de traitement médical.'}</p>
        </div>
      `;
    } else if (type === "quote") {
      modalTitle.textContent = "Devis Optique Proforma";
      const totalText = document.getElementById("basketTotal").textContent;
      const subtotalText = document.getElementById("basketSubtotal").textContent;
      const tvaText = document.getElementById("basketTaxes").textContent;
      const insuranceText = document.getElementById("basketInsurancePart").textContent;

      let rows = "";
      this.state.basket.forEach(item => {
        rows += `
          <tr>
            <td>${item.name}</td>
            <td style="text-align:right;">${item.qty}</td>
            <td style="text-align:right;">${this.formatCurrency(item.price).replace(/[A-Z]/g,'')}</td>
          </tr>
        `;
      });

      htmlContent = `
        <div class="print-header">
          <div>
            <span class="print-logo-text" style="color:var(--accent-orange);">OculoOptique</span>
            <div class="print-clinic-details">Centre Optique Dakar</div>
          </div>
          <div class="print-doc-meta">
            <h2>DEVIS PROFORMA</h2>
            Date : ${dateStr}
          </div>
        </div>

        <table class="print-table">
          <thead>
            <tr>
              <th>Désignation</th>
              <th style="text-align:right;">Qté</th>
              <th style="text-align:right;">Total HT (XOF/XAF)</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="print-totals">
          <div class="print-totals-row"><span>Sous-total HT</span><span>${subtotalText}</span></div>
          <div class="print-totals-row"><span style="color:var(--accent-blue);">Mutuelle / Prise en charge</span><span>${insuranceText}</span></div>
          <div class="print-totals-row"><span>TVA (18%)</span><span>${tvaText}</span></div>
          <div class="print-totals-row final"><span>RESTE À PAYER PATIENT</span><span>${totalText}</span></div>
        </div>
      `;
    }

    printableArea.innerHTML = htmlContent;
    this.openModal("invoiceViewerModal");
    lucide.createIcons();
  }

  // ==========================================
  // CLINICAL IA SCAN SIMULATOR
  // ==========================================
  initIASimulator() {
    const trigger = document.getElementById("iaUploadTrigger");
    const visualizer = document.getElementById("iaScanVisualizer");
    const preview = document.getElementById("scannedImagePreview");

    if (!trigger) return;

    trigger.addEventListener("click", () => {
      trigger.innerHTML = `<i data-lucide="loader" class="upload-icon animate-spin"></i><span>Analyse clinique par IA en cours...</span>`;
      lucide.createIcons();

      setTimeout(() => {
        trigger.innerHTML = `<i data-lucide="upload-cloud" class="upload-icon"></i><span>Simuler le téléversement d'un cliché (OCT ou Rétinographie)</span>`;
        lucide.createIcons();

        visualizer.style.display = "block";
        preview.innerHTML = `
          <svg viewBox="0 0 100 100" class="w-full h-full">
            <circle cx="50" cy="50" r="45" fill="#3c1500" stroke="#0d6efd" stroke-width="2"/>
            <path d="M50,5 C55,45 45,55 50,95" stroke="#ff3c00" stroke-width="1.5" fill="none"/>
            <circle cx="50" cy="50" r="10" fill="#ffa200" opacity="0.9"/>
            <circle cx="35" cy="40" r="1.5" fill="#ffffaa"/>
          </svg>
        `;

        document.getElementById("iaGlaucomaProb").textContent = "Probabilité 18% (Faible)";
        document.getElementById("iaGlaucomaProb").className = "text-green";
        document.getElementById("iaDiabeticProb").textContent = "Probabilité 86% (Rétinopathie suspectée)";
        document.getElementById("iaDiabeticProb").className = "text-red";
        document.getElementById("iaOedemaProb").textContent = "Probabilité 54% (Modérée)";
        document.getElementById("iaOedemaProb").className = "text-accent-orange";

        document.getElementById("diagFinal").value = "Rétinopathie diabétique non proliférante modérée avec œdème maculaire débutant";
        document.getElementById("prescMedical").value = "Collyre anti-VEGF recommandé. Planifier OCT de contrôle à 30 jours.";

      }, 1500);
    });
  }

  // ==========================================
  // HEADER NOTIFICATIONS
  // ==========================================
  renderHeaderNotifications() {
    const list = document.getElementById("notifDropdownList");
    const countBadge = document.getElementById("unreadNotifCount");

    list.innerHTML = "";
    
    const stockAlerts = this.state.stock.filter(s => s.qty <= s.minAlert);
    let notifications = [];

    if (stockAlerts.length > 0) {
      notifications.push({
        id: "notif-stock",
        title: "Alerte Stock Critique",
        desc: `${stockAlerts.length} articles d'optique sont sous le seuil d'alerte.`,
        time: "Il y a 2 min",
        unread: true
      });
    }

    notifications.push({
      id: "notif-surg",
      title: "Chirurgie Planifiée",
      desc: "Chirurgie de cataracte pour Amadou Touré planifiée le 30 Juin.",
      time: "Il y a 10 min",
      unread: true
    });

    countBadge.textContent = notifications.filter(n => n.unread).length;

    notifications.forEach(n => {
      list.innerHTML += `
        <li class="notif-item ${n.unread ? 'unread' : ''}">
          <strong>${n.title}</strong>
          <span class="text-xs text-secondary">${n.desc}</span>
          <span class="notif-time">${n.time}</span>
        </li>
      `;
    });
  }

  // ==========================================
  // UTILS
  // ==========================================
  formatCurrency(value) {
    const sym = this.state.currency;
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: sym, minimumFractionDigits: 0 }).format(value);
  }

  calculateAge(birthDateString) {
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  }

  renderCharts() {
    const ctxRevenue = document.getElementById("revenueChart");
    if (!ctxRevenue) return;

    if (this.charts.revenue) this.charts.revenue.destroy();

    this.charts.revenue = new Chart(ctxRevenue, {
      type: 'line',
      data: {
        labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'],
        datasets: [
          {
            label: 'Revenus Caisse (' + this.state.currency + ')',
            data: [3500000, 4200000, 5100000, 4900000, 6800000, 8450000],
            borderColor: '#0d6efd',
            backgroundColor: 'rgba(13, 110, 253, 0.05)',
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            yAxisID: 'y'
          },
          {
            label: 'Consultations (Volume)',
            data: [150, 180, 210, 195, 290, 342],
            borderColor: '#f97316',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3af' } }
        },
        scales: {
          x: {
            grid: { color: 'rgba(0,0,0,0.02)' },
            ticks: { color: '#9ca3af' }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            grid: { color: 'rgba(0,0,0,0.02)' },
            ticks: { color: '#9ca3af', callback: (value) => value / 1000 + 'k' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#9ca3af' }
          }
        }
      }
    });

    const ctxPayments = document.getElementById("paymentMethodsChart");
    if (!ctxPayments) return;

    if (this.charts.payments) this.charts.payments.destroy();

    this.charts.payments = new Chart(ctxPayments, {
      type: 'doughnut',
      data: {
        labels: ['Wave', 'Orange', 'MTN MoMo', 'Espèces', 'Visa/MC'],
        datasets: [{
          data: [45, 22, 10, 15, 8],
          backgroundColor: ['#00a2e8', '#ff6600', '#ffbc00', '#20c997', '#0d6efd'],
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#9ca3af' } }
        }
      }
    });
  }
}

// Global instantiation
const app = new OculoSaaSApp();
window.addEventListener("DOMContentLoaded", () => {
  app.init();
});
