// GERADO de engine/data/food-keys.json (sha256: 8e0c402d258e5b4e50b42e178b83dbf517acbafab2476573ceae6615d2be59a1). Não editar à mão.
// Regerar: cd BalancoGordura/engine && npx tsx scripts/export-selah-food-keys.ts

export const MEAL_PHOTO_FOOD_KEYS = [
  "arroz_branco",
  "arroz_integral",
  "cuscuz_milho",
  "farofa",
  "tapioca",
  "pao_frances",
  "pao_integral",
  "pao_de_queijo",
  "torrada",
  "biscoito_recheado",
  "aveia",
  "cereal_matinal",
  "milho_verde",
  "pipoca",
  "polenta",
  "nhoque",
  "batata_inglesa",
  "batata_doce",
  "mandioca",
  "inhame",
  "feijao_carioca",
  "feijao_preto",
  "feijao_tropeiro",
  "lentilha",
  "grao_de_bico",
  "ervilha",
  "carne_bovina_bife",
  "carne_bovina_acem",
  "carne_moida",
  "picanha",
  "costela_bovina",
  "fraldinha",
  "frango_peito",
  "frango_coxa_sobrecoxa",
  "frango_desfiado",
  "linguica",
  "presunto",
  "hamburguer_carne",
  "carne_suina_lombo",
  "bisteca_suina",
  "figado_bovino",
  "almondega",
  "salmao",
  "sardinha",
  "atum_lata",
  "camarao",
  "peixe_frito_file",
  "ovo_cozido",
  "ovo_frito",
  "omelete",
  "iogurte_natural",
  "iogurte_frutas",
  "queijo_mussarela",
  "queijo_minas",
  "queijo_prato",
  "requeijao",
  "ricota",
  "queijo_parmesao",
  "manteiga",
  "margarina",
  "alface",
  "tomate",
  "cenoura",
  "pepino",
  "brocolis",
  "couve",
  "couve_flor",
  "abobrinha",
  "berinjela",
  "beterraba",
  "chuchu",
  "repolho",
  "espinafre",
  "vagem",
  "cebola",
  "pimentao",
  "abobora",
  "quiabo",
  "rucula",
  "palmito",
  "banana",
  "maca",
  "laranja",
  "mamao",
  "melancia",
  "melao",
  "abacaxi",
  "manga",
  "uva",
  "morango",
  "abacate",
  "pera",
  "tangerina",
  "kiwi",
  "acai_polpa",
  "azeite",
  "oleo_vegetal",
  "castanha_do_para",
  "castanha_de_caju",
  "amendoim",
  "nozes",
  "amendoas",
  "chocolate_ao_leite",
  "chocolate_amargo",
  "acucar",
  "mel",
  "doce_de_leite",
  "suco_laranja",
  "refrigerante",
  "cafe_sem_acucar",
  "cha",
  "agua_de_coco",
  "cerveja",
  "strogonoff_frango",
  "coxinha",
  "pastel",
  "molho_tomate",
  "maionese",
  "macarrao",
  "leite_integral",
  "leite_desnatado",
  "tilapia",
  "iogurte_grego",
  "ovo_mexido"
] as const;

export type MealPhotoFoodKey = (typeof MEAL_PHOTO_FOOD_KEYS)[number];

export const MEAL_PHOTO_FOOD_LABELS: Readonly<Record<string, string>> = {
  "arroz_branco": "Arroz branco",
  "arroz_integral": "Arroz integral",
  "cuscuz_milho": "Cuscuz de milho",
  "farofa": "Farofa de mandioca temperada",
  "tapioca": "Tapioca com manteiga",
  "pao_frances": "Pão francês",
  "pao_integral": "Pão integral (de forma)",
  "pao_de_queijo": "Pão de queijo",
  "torrada": "Torrada",
  "biscoito_recheado": "Biscoito recheado",
  "aveia": "Aveia",
  "cereal_matinal": "Cereal matinal",
  "milho_verde": "Milho verde (cru ou enlatado)",
  "pipoca": "Pipoca",
  "polenta": "Polenta",
  "nhoque": "Nhoque",
  "batata_inglesa": "Batata inglesa",
  "batata_doce": "Batata-doce",
  "mandioca": "Mandioca (aipim)",
  "inhame": "Inhame",
  "feijao_carioca": "Feijão carioca",
  "feijao_preto": "Feijão preto",
  "feijao_tropeiro": "Feijão tropeiro",
  "lentilha": "Lentilha",
  "grao_de_bico": "Grão-de-bico",
  "ervilha": "Ervilha",
  "carne_bovina_bife": "Bife bovino",
  "carne_bovina_acem": "Carne bovina (acém, cozida)",
  "carne_moida": "Carne moída (acém, cozida)",
  "picanha": "Picanha",
  "costela_bovina": "Costela bovina",
  "fraldinha": "Fraldinha",
  "frango_peito": "Frango (peito)",
  "frango_coxa_sobrecoxa": "Frango (coxa/sobrecoxa)",
  "frango_desfiado": "Frango desfiado",
  "linguica": "Linguiça de porco",
  "presunto": "Presunto",
  "hamburguer_carne": "Hambúrguer (carne)",
  "carne_suina_lombo": "Lombo suíno",
  "bisteca_suina": "Bisteca suína",
  "figado_bovino": "Fígado bovino",
  "almondega": "Almôndega",
  "salmao": "Salmão",
  "sardinha": "Sardinha",
  "atum_lata": "Atum em lata",
  "camarao": "Camarão",
  "peixe_frito_file": "Filé de peixe empanado",
  "ovo_cozido": "Ovo cozido",
  "ovo_frito": "Ovo frito",
  "omelete": "Omelete de queijo",
  "iogurte_natural": "Iogurte natural",
  "iogurte_frutas": "Iogurte com frutas (sabor morango)",
  "queijo_mussarela": "Queijo mussarela",
  "queijo_minas": "Queijo minas",
  "queijo_prato": "Queijo prato",
  "requeijao": "Requeijão",
  "ricota": "Ricota",
  "queijo_parmesao": "Queijo parmesão",
  "manteiga": "Manteiga (com sal)",
  "margarina": "Margarina (com sal)",
  "alface": "Alface",
  "tomate": "Tomate",
  "cenoura": "Cenoura",
  "pepino": "Pepino",
  "brocolis": "Brócolis",
  "couve": "Couve",
  "couve_flor": "Couve-flor",
  "abobrinha": "Abobrinha",
  "berinjela": "Berinjela",
  "beterraba": "Beterraba",
  "chuchu": "Chuchu",
  "repolho": "Repolho",
  "espinafre": "Espinafre",
  "vagem": "Vagem",
  "cebola": "Cebola",
  "pimentao": "Pimentão",
  "abobora": "Abóbora",
  "quiabo": "Quiabo",
  "rucula": "Rúcula",
  "palmito": "Palmito",
  "banana": "Banana",
  "maca": "Maçã",
  "laranja": "Laranja",
  "mamao": "Mamão",
  "melancia": "Melancia",
  "melao": "Melão",
  "abacaxi": "Abacaxi",
  "manga": "Manga",
  "uva": "Uva",
  "morango": "Morango",
  "abacate": "Abacate",
  "pera": "Pera",
  "tangerina": "Tangerina",
  "kiwi": "Kiwi",
  "acai_polpa": "Açaí (polpa congelada)",
  "azeite": "Azeite de oliva",
  "oleo_vegetal": "Óleo vegetal",
  "castanha_do_para": "Castanha-do-pará",
  "castanha_de_caju": "Castanha de caju",
  "amendoim": "Amendoim torrado e salgado",
  "nozes": "Nozes",
  "amendoas": "Amêndoas",
  "chocolate_ao_leite": "Chocolate ao leite",
  "chocolate_amargo": "Chocolate meio amargo",
  "acucar": "Açúcar",
  "mel": "Mel",
  "doce_de_leite": "Doce de leite",
  "suco_laranja": "Suco de laranja",
  "refrigerante": "Refrigerante (tipo cola)",
  "cafe_sem_acucar": "Café sem açúcar",
  "cha": "Chá preto",
  "agua_de_coco": "Água de coco",
  "cerveja": "Cerveja",
  "strogonoff_frango": "Strogonoff de frango",
  "coxinha": "Coxinha",
  "pastel": "Pastel",
  "molho_tomate": "Molho de tomate",
  "maionese": "Maionese",
  "macarrao": "Macarrão cozido",
  "leite_integral": "Leite integral",
  "leite_desnatado": "Leite desnatado",
  "tilapia": "Tilápia (grelhada ou assada)",
  "iogurte_grego": "Iogurte grego natural (integral)",
  "ovo_mexido": "Ovo mexido"
};

/** Preparos permitidos por alimento. */
export const MEAL_PHOTO_FOOD_PREPAROS: Readonly<Record<string, readonly string[]>> = {
  "arroz_branco": [
    "cozido"
  ],
  "arroz_integral": [
    "cozido"
  ],
  "cuscuz_milho": [
    "cozido"
  ],
  "farofa": [
    "refogado",
    "nao_se_aplica"
  ],
  "tapioca": [
    "nao_se_aplica"
  ],
  "pao_frances": [
    "nao_se_aplica"
  ],
  "pao_integral": [
    "nao_se_aplica"
  ],
  "pao_de_queijo": [
    "assado"
  ],
  "torrada": [
    "nao_se_aplica"
  ],
  "biscoito_recheado": [
    "nao_se_aplica"
  ],
  "aveia": [
    "cru"
  ],
  "cereal_matinal": [
    "nao_se_aplica"
  ],
  "milho_verde": [
    "cru",
    "nao_se_aplica"
  ],
  "pipoca": [
    "nao_se_aplica"
  ],
  "polenta": [
    "cozido"
  ],
  "nhoque": [
    "cozido"
  ],
  "batata_inglesa": [
    "frito",
    "cozido",
    "cru",
    "refogado",
    "assado"
  ],
  "batata_doce": [
    "cozido",
    "cru",
    "assado"
  ],
  "mandioca": [
    "frito",
    "cozido",
    "cru"
  ],
  "inhame": [
    "cru"
  ],
  "feijao_carioca": [
    "cozido"
  ],
  "feijao_preto": [
    "cozido"
  ],
  "feijao_tropeiro": [
    "nao_se_aplica"
  ],
  "lentilha": [
    "cozido"
  ],
  "grao_de_bico": [
    "cru"
  ],
  "ervilha": [
    "nao_se_aplica"
  ],
  "carne_bovina_bife": [
    "grelhado",
    "empanado"
  ],
  "carne_bovina_acem": [
    "cozido"
  ],
  "carne_moida": [
    "cozido"
  ],
  "picanha": [
    "grelhado"
  ],
  "costela_bovina": [
    "assado"
  ],
  "fraldinha": [
    "cozido"
  ],
  "frango_peito": [
    "grelhado",
    "cozido",
    "cru",
    "empanado",
    "assado"
  ],
  "frango_coxa_sobrecoxa": [
    "cozido",
    "assado"
  ],
  "frango_desfiado": [
    "cozido"
  ],
  "linguica": [
    "grelhado",
    "frito"
  ],
  "presunto": [
    "nao_se_aplica"
  ],
  "hamburguer_carne": [
    "grelhado",
    "frito"
  ],
  "carne_suina_lombo": [
    "assado"
  ],
  "bisteca_suina": [
    "grelhado",
    "frito"
  ],
  "figado_bovino": [
    "grelhado"
  ],
  "almondega": [
    "frito"
  ],
  "salmao": [
    "grelhado"
  ],
  "sardinha": [
    "frito",
    "assado",
    "nao_se_aplica"
  ],
  "atum_lata": [
    "nao_se_aplica"
  ],
  "camarao": [
    "frito",
    "cozido"
  ],
  "peixe_frito_file": [
    "frito",
    "empanado"
  ],
  "ovo_cozido": [
    "cozido"
  ],
  "ovo_frito": [
    "frito"
  ],
  "omelete": [
    "nao_se_aplica"
  ],
  "iogurte_natural": [
    "nao_se_aplica"
  ],
  "iogurte_frutas": [
    "nao_se_aplica"
  ],
  "queijo_mussarela": [
    "nao_se_aplica"
  ],
  "queijo_minas": [
    "nao_se_aplica"
  ],
  "queijo_prato": [
    "nao_se_aplica"
  ],
  "requeijao": [
    "nao_se_aplica"
  ],
  "ricota": [
    "nao_se_aplica"
  ],
  "queijo_parmesao": [
    "nao_se_aplica"
  ],
  "manteiga": [
    "nao_se_aplica"
  ],
  "margarina": [
    "nao_se_aplica"
  ],
  "alface": [
    "cru"
  ],
  "tomate": [
    "cru"
  ],
  "cenoura": [
    "cozido",
    "cru"
  ],
  "pepino": [
    "cru"
  ],
  "brocolis": [
    "cozido",
    "cru"
  ],
  "couve": [
    "cru",
    "refogado"
  ],
  "couve_flor": [
    "cozido",
    "cru"
  ],
  "abobrinha": [
    "cozido",
    "cru",
    "refogado"
  ],
  "berinjela": [
    "cozido",
    "cru"
  ],
  "beterraba": [
    "cozido",
    "cru"
  ],
  "chuchu": [
    "cozido",
    "cru"
  ],
  "repolho": [
    "cru"
  ],
  "espinafre": [
    "cru",
    "refogado"
  ],
  "vagem": [
    "cru"
  ],
  "cebola": [
    "cru"
  ],
  "pimentao": [
    "cru"
  ],
  "abobora": [
    "cozido",
    "cru",
    "refogado"
  ],
  "quiabo": [
    "cru"
  ],
  "rucula": [
    "cru"
  ],
  "palmito": [
    "nao_se_aplica"
  ],
  "banana": [
    "cru"
  ],
  "maca": [
    "cru"
  ],
  "laranja": [
    "cru"
  ],
  "mamao": [
    "cru"
  ],
  "melancia": [
    "cru"
  ],
  "melao": [
    "cru"
  ],
  "abacaxi": [
    "cru"
  ],
  "manga": [
    "cru"
  ],
  "uva": [
    "cru"
  ],
  "morango": [
    "cru"
  ],
  "abacate": [
    "cru"
  ],
  "pera": [
    "cru"
  ],
  "tangerina": [
    "cru"
  ],
  "kiwi": [
    "cru"
  ],
  "acai_polpa": [
    "nao_se_aplica"
  ],
  "azeite": [
    "nao_se_aplica"
  ],
  "oleo_vegetal": [
    "nao_se_aplica"
  ],
  "castanha_do_para": [
    "nao_se_aplica"
  ],
  "castanha_de_caju": [
    "nao_se_aplica"
  ],
  "amendoim": [
    "nao_se_aplica"
  ],
  "nozes": [
    "nao_se_aplica"
  ],
  "amendoas": [
    "nao_se_aplica"
  ],
  "chocolate_ao_leite": [
    "nao_se_aplica"
  ],
  "chocolate_amargo": [
    "nao_se_aplica"
  ],
  "acucar": [
    "nao_se_aplica"
  ],
  "mel": [
    "nao_se_aplica"
  ],
  "doce_de_leite": [
    "nao_se_aplica"
  ],
  "suco_laranja": [
    "nao_se_aplica"
  ],
  "refrigerante": [
    "nao_se_aplica"
  ],
  "cafe_sem_acucar": [
    "nao_se_aplica"
  ],
  "cha": [
    "nao_se_aplica"
  ],
  "agua_de_coco": [
    "nao_se_aplica"
  ],
  "cerveja": [
    "nao_se_aplica"
  ],
  "strogonoff_frango": [
    "nao_se_aplica"
  ],
  "coxinha": [
    "frito"
  ],
  "pastel": [
    "frito"
  ],
  "molho_tomate": [
    "nao_se_aplica"
  ],
  "maionese": [
    "nao_se_aplica"
  ],
  "macarrao": [
    "cozido"
  ],
  "leite_integral": [
    "nao_se_aplica"
  ],
  "leite_desnatado": [
    "nao_se_aplica"
  ],
  "tilapia": [
    "grelhado",
    "assado"
  ],
  "iogurte_grego": [
    "nao_se_aplica"
  ],
  "ovo_mexido": [
    "refogado"
  ]
};

export const MEAL_PHOTO_PREPAROS = ["grelhado","frito","cozido","cru","refogado","empanado","assado","nao_se_aplica"] as const;
