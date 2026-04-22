use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Definimos as tabelas que serão criadas na primeira vez que o programa abrir
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "
                CREATE TABLE IF NOT EXISTS produtos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL,
                    categoria TEXT,
                    tamanho TEXT,
                    cor TEXT,
                    quantidade INTEGER DEFAULT 0,
                    preco_venda REAL DEFAULT 0.0
                );

                CREATE TABLE IF NOT EXISTS vendas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    produto_id INTEGER,
                    quantidade INTEGER,
                    valor_total REAL,
                    data_venda DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(produto_id) REFERENCES produtos(id)
                );

                CREATE TABLE IF NOT EXISTS financeiro (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    descricao TEXT,
                    tipo TEXT,
                    valor REAL,
                    data DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            ",
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        // Inicializa o plugin de SQL e cria o ficheiro preta_sexy.db
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:preta_sexy.db", migrations)
                .build(),
        )
        // Se já tiver outros plugins aqui (como o shell), pode mantê-los por baixo
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}