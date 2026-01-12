use serde_json::json;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};

pub struct ProcessManager {
    resource_dir: PathBuf,
    data_dir: PathBuf,
    phoenixd: Option<Child>,
    backend: Option<Child>,
    frontend: Option<Child>,
}

impl ProcessManager {
    pub fn new(resource_dir: PathBuf, data_dir: PathBuf) -> Self {
        // In development, resources might be in a different location
        let actual_resource_dir = Self::find_resource_dir(&resource_dir);
        
        Self {
            resource_dir: actual_resource_dir,
            data_dir,
            phoenixd: None,
            backend: None,
            frontend: None,
        }
    }
    
    fn find_resource_dir(default_dir: &PathBuf) -> PathBuf {
        // Helper to check if a directory has all required resources
        fn has_all_resources(dir: &PathBuf) -> bool {
            let has_phoenixd = dir.join("binaries").join("phoenixd").exists() 
                || dir.join("binaries").join("phoenixd.exe").exists();
            let has_backend = dir.join("backend").join("dist").join("index.js").exists();
            let has_frontend = dir.join("frontend").join("server.js").exists();
            
            println!("Checking resources at {:?}: phoenixd={}, backend={}, frontend={}", 
                dir, has_phoenixd, has_backend, has_frontend);
            
            has_phoenixd && has_backend && has_frontend
        }
        
        // Check if all resources exist in the default location
        if has_all_resources(default_dir) {
            println!("Using bundled resources at: {:?}", default_dir);
            return default_dir.clone();
        }
        
        // Check for _up_/resources (Tauri bundles relative paths here)
        let up_resources = default_dir.join("_up_").join("resources");
        if has_all_resources(&up_resources) {
            println!("Using bundled resources at: {:?}", up_resources);
            return up_resources;
        }
        
        // In development, check desktop/resources
        // Path: target/debug -> target -> src-tauri -> desktop/resources
        let dev_resources = default_dir
            .parent() // target
            .and_then(|p| p.parent()) // src-tauri
            .and_then(|p| p.parent()) // desktop
            .map(|p| p.join("resources"));
            
        if let Some(dev_path) = dev_resources {
            if has_all_resources(&dev_path) {
                println!("Using development resources at: {:?}", dev_path);
                return dev_path;
            }
        }
        
        // Fall back to default (will error later if resources not found)
        println!("Warning: Could not find complete resources, using default: {:?}", default_dir);
        default_dir.clone()
    }

    pub fn start_all(&mut self) -> Result<(), String> {
        println!("Starting all services...");
        
        // Start phoenixd first
        self.start_phoenixd()?;
        
        // Wait a bit for phoenixd to initialize
        std::thread::sleep(std::time::Duration::from_secs(2));
        
        // Start backend
        self.start_backend()?;
        
        // Wait for backend to be ready
        std::thread::sleep(std::time::Duration::from_secs(1));
        
        // Start frontend
        self.start_frontend()?;
        
        println!("All services started!");
        Ok(())
    }

    fn start_phoenixd(&mut self) -> Result<(), String> {
        let phoenixd_binary = self.get_phoenixd_binary_path();
        
        if !phoenixd_binary.exists() {
            return Err(format!(
                "Phoenixd binary not found at: {:?}. Please ensure phoenixd is installed.",
                phoenixd_binary
            ));
        }

        // Phoenixd stores data in ~/.phoenix by default
        // We set HOME to our data_dir so it uses data_dir/.phoenix
        let phoenixd_home = self.data_dir.clone();
        std::fs::create_dir_all(&phoenixd_home)
            .map_err(|e| format!("Failed to create phoenixd home dir: {}", e))?;

        println!("Starting phoenixd from: {:?}", phoenixd_binary);
        println!("Phoenixd HOME: {:?}", phoenixd_home);

        let child = Command::new(&phoenixd_binary)
            .arg("--agree-to-terms-of-service")
            .arg("--http-bind-ip")
            .arg("127.0.0.1")
            .env("HOME", &phoenixd_home)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start phoenixd: {}", e))?;

        self.phoenixd = Some(child);
        println!("Phoenixd started successfully");
        Ok(())
    }

    fn start_backend(&mut self) -> Result<(), String> {
        let backend_dir = self.resource_dir.join("backend");
        let node_path = self.find_node_binary()?;
        
        let backend_entry = backend_dir.join("dist").join("index.js");
        
        if !backend_entry.exists() {
            return Err(format!(
                "Backend entry point not found at: {:?}",
                backend_entry
            ));
        }

        // Setup environment for backend
        // Phoenixd stores data in $HOME/.phoenix
        let phoenix_conf = self.data_dir.join(".phoenix").join("phoenix.conf");
        
        // Read phoenixd password from config if available
        let phoenixd_password = self.read_phoenixd_password(&phoenix_conf);
        
        // SQLite database path
        let db_path = self.data_dir.join("dashboard.db");
        let database_url = format!("file:{}", db_path.display());

        println!("Starting backend from: {:?}", backend_entry);
        println!("Database URL: {}", database_url);
        
        // Copy template database if it doesn't exist
        if !db_path.exists() {
            let template_db = self.resource_dir.join("template.db");
            if template_db.exists() {
                println!("Initializing database from template...");
                if let Err(e) = std::fs::copy(&template_db, &db_path) {
                    eprintln!("Warning: Could not copy template database: {}", e);
                } else {
                    println!("Database initialized successfully");
                }
            } else {
                eprintln!("Warning: Template database not found at {:?}", template_db);
            }
        }

        let child = Command::new(&node_path)
            .arg(&backend_entry)
            .current_dir(&backend_dir)
            .env("NODE_ENV", "production")
            .env("PORT", "4000")
            .env("DESKTOP_MODE", "true")
            .env("DATABASE_URL", &database_url)
            .env("PHOENIXD_URL", "http://127.0.0.1:9740")
            .env("PHOENIXD_PASSWORD", &phoenixd_password)
            .env("FRONTEND_URL", "http://localhost:3000")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start backend: {}", e))?;

        self.backend = Some(child);
        println!("Backend started successfully");
        Ok(())
    }

    fn start_frontend(&mut self) -> Result<(), String> {
        let frontend_dir = self.resource_dir.join("frontend");
        let node_path = self.find_node_binary()?;
        
        // For standalone Next.js build
        let server_js = frontend_dir.join("server.js");
        
        if !server_js.exists() {
            return Err(format!(
                "Frontend server not found at: {:?}. Make sure to build with 'next build' (standalone output).",
                server_js
            ));
        }

        println!("Starting frontend from: {:?}", server_js);

        let child = Command::new(&node_path)
            .arg(&server_js)
            .current_dir(&frontend_dir)
            .env("NODE_ENV", "production")
            .env("PORT", "3000")
            .env("HOSTNAME", "localhost")
            .env("NEXT_PUBLIC_API_URL", "http://localhost:4000")
            .env("NEXT_PUBLIC_WS_URL", "ws://localhost:4000")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start frontend: {}", e))?;

        self.frontend = Some(child);
        println!("Frontend started successfully");
        Ok(())
    }

    fn get_phoenixd_binary_path(&self) -> PathBuf {
        let binary_name = if cfg!(target_os = "windows") {
            "phoenixd.exe"
        } else {
            "phoenixd"
        };
        
        // First check in resources/binaries
        let bundled = self.resource_dir.join("binaries").join(binary_name);
        if bundled.exists() {
            return bundled;
        }
        
        // Then check system PATH
        if let Ok(path) = which::which("phoenixd") {
            return path;
        }
        
        // Default to bundled path (will error later if not found)
        bundled
    }

    fn find_node_binary(&self) -> Result<PathBuf, String> {
        // First check in resources (bundled Node.js)
        let bundled_node = if cfg!(target_os = "windows") {
            self.resource_dir.join("node").join("node.exe")
        } else {
            self.resource_dir.join("node").join("bin").join("node")
        };
        
        if bundled_node.exists() {
            return Ok(bundled_node);
        }
        
        // Fall back to system Node.js
        which::which("node")
            .map_err(|_| "Node.js not found. Please install Node.js or include it in the app bundle.".to_string())
    }

    fn read_phoenixd_password(&self, config_path: &PathBuf) -> String {
        if !config_path.exists() {
            return String::new();
        }
        
        match std::fs::read_to_string(config_path) {
            Ok(content) => {
                for line in content.lines() {
                    if line.starts_with("http-password=") {
                        return line.replace("http-password=", "").trim().to_string();
                    }
                }
                String::new()
            }
            Err(_) => String::new(),
        }
    }

    pub fn stop_all(&mut self) {
        println!("Stopping all services...");
        
        // Stop in reverse order
        if let Some(mut child) = self.frontend.take() {
            println!("Stopping frontend...");
            let _ = child.kill();
            let _ = child.wait();
        }
        
        if let Some(mut child) = self.backend.take() {
            println!("Stopping backend...");
            let _ = child.kill();
            let _ = child.wait();
        }
        
        if let Some(mut child) = self.phoenixd.take() {
            println!("Stopping phoenixd...");
            let _ = child.kill();
            let _ = child.wait();
        }
        
        println!("All services stopped");
    }

    pub fn get_status(&self) -> serde_json::Value {
        json!({
            "phoenixd": self.phoenixd.as_ref().map(|c| {
                json!({
                    "running": c.id() > 0,
                    "pid": c.id()
                })
            }),
            "backend": self.backend.as_ref().map(|c| {
                json!({
                    "running": c.id() > 0,
                    "pid": c.id()
                })
            }),
            "frontend": self.frontend.as_ref().map(|c| {
                json!({
                    "running": c.id() > 0,
                    "pid": c.id()
                })
            })
        })
    }
}

impl Drop for ProcessManager {
    fn drop(&mut self) {
        self.stop_all();
    }
}
