use std::path::PathBuf;
use std::process::{Command, Stdio};

pub struct DockerManager {
    project_dir: PathBuf,
}

impl DockerManager {
    pub fn new(project_dir: PathBuf) -> Self {
        Self { project_dir }
    }

    /// Check if Docker is installed and running
    pub fn is_docker_available(&self) -> bool {
        Command::new("docker")
            .arg("info")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }

    /// Check if Docker is installed (but maybe not running)
    pub fn is_docker_installed(&self) -> bool {
        Command::new("docker")
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }

    /// Find docker-compose.yml in various locations
    fn find_compose_file(&self) -> std::path::PathBuf {
        // Check in _up_/resources (bundled)
        let bundled = self.project_dir.join("_up_").join("resources").join("docker-compose.yml");
        if bundled.exists() {
            return bundled;
        }
        
        // Check in project_dir directly
        let direct = self.project_dir.join("docker-compose.yml");
        if direct.exists() {
            return direct;
        }
        
        // Default to bundled path
        bundled
    }

    /// Get Docker installation instructions/script for current platform
    pub fn get_install_info(&self) -> DockerInstallInfo {
        #[cfg(target_os = "linux")]
        {
            DockerInstallInfo {
                platform: "Linux".to_string(),
                can_auto_install: true,
                install_command: Some("curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker $USER".to_string()),
                download_url: "https://docs.docker.com/engine/install/".to_string(),
                instructions: "Docker será instalado automaticamente. Você precisará digitar sua senha de administrador.".to_string(),
            }
        }

        #[cfg(target_os = "macos")]
        {
            let arch = if cfg!(target_arch = "aarch64") {
                "arm64"
            } else {
                "amd64"
            };
            DockerInstallInfo {
                platform: "macOS".to_string(),
                can_auto_install: false,
                install_command: None,
                download_url: format!("https://desktop.docker.com/mac/main/{}/Docker.dmg", arch),
                instructions: "1. O instalador será baixado\n2. Abra o arquivo Docker.dmg\n3. Arraste Docker para Applications\n4. Abra o Docker e aguarde iniciar".to_string(),
            }
        }

        #[cfg(target_os = "windows")]
        {
            DockerInstallInfo {
                platform: "Windows".to_string(),
                can_auto_install: false,
                install_command: None,
                download_url: "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe".to_string(),
                instructions: "1. O instalador será baixado\n2. Execute o instalador\n3. Siga as instruções na tela\n4. Reinicie o computador se necessário".to_string(),
            }
        }
    }

    /// Try to install Docker (Linux only for auto-install)
    pub fn install_docker(&self) -> Result<(), String> {
        let info = self.get_install_info();

        if info.can_auto_install {
            #[cfg(target_os = "linux")]
            {
                // Run the install script
                let status = Command::new("sh")
                    .arg("-c")
                    .arg("curl -fsSL https://get.docker.com | sudo sh")
                    .status()
                    .map_err(|e| format!("Failed to run install script: {}", e))?;

                if !status.success() {
                    return Err("Docker installation failed".to_string());
                }

                // Add user to docker group
                let user = std::env::var("USER").unwrap_or_else(|_| "root".to_string());
                let _ = Command::new("sudo")
                    .args(["usermod", "-aG", "docker", &user])
                    .status();

                Ok(())
            }

            #[cfg(not(target_os = "linux"))]
            {
                Err("Auto-install only available on Linux".to_string())
            }
        } else {
            // Open download URL in browser
            let _ = open::that(&info.download_url);
            Err(format!("Por favor, instale o Docker manualmente:\n{}", info.instructions))
        }
    }

    /// Start Docker containers using docker-compose
    pub fn start_containers(&self) -> Result<(), String> {
        // Look for docker-compose in resources/_up_/resources/ first, then project_dir
        let compose_file = self.find_compose_file();
        
        if !compose_file.exists() {
            return Err(format!("docker-compose.yml not found at {:?}", compose_file));
        }

        println!("Starting Docker containers from {:?}", compose_file);

        // First, pull images
        let pull_status = Command::new("docker")
            .args(["compose", "-f", compose_file.to_str().unwrap(), "pull"])
            .current_dir(&self.project_dir)
            .status()
            .map_err(|e| format!("Failed to pull images: {}", e))?;

        if !pull_status.success() {
            eprintln!("Warning: Failed to pull some images, continuing anyway...");
        }

        // Start containers in detached mode
        let status = Command::new("docker")
            .args(["compose", "-f", compose_file.to_str().unwrap(), "up", "-d"])
            .current_dir(&self.project_dir)
            .status()
            .map_err(|e| format!("Failed to start containers: {}", e))?;

        if status.success() {
            println!("Docker containers started successfully");
            Ok(())
        } else {
            Err("Failed to start Docker containers".to_string())
        }
    }

    /// Stop Docker containers
    pub fn stop_containers(&self) -> Result<(), String> {
        let compose_file = self.find_compose_file();
        
        if !compose_file.exists() {
            return Ok(()); // Nothing to stop
        }

        println!("Stopping Docker containers...");

        let status = Command::new("docker")
            .args(["compose", "-f", compose_file.to_str().unwrap(), "down"])
            .current_dir(&self.project_dir)
            .status()
            .map_err(|e| format!("Failed to stop containers: {}", e))?;

        if status.success() {
            println!("Docker containers stopped");
            Ok(())
        } else {
            Err("Failed to stop Docker containers".to_string())
        }
    }

    /// Get status of Docker containers
    pub fn get_container_status(&self) -> Vec<ContainerStatus> {
        let output = Command::new("docker")
            .args(["compose", "ps", "--format", "json"])
            .current_dir(&self.project_dir)
            .output();

        match output {
            Ok(out) if out.status.success() => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                // Parse JSON output (simplified)
                let mut statuses = Vec::new();
                for line in stdout.lines() {
                    if let Ok(container) = serde_json::from_str::<serde_json::Value>(line) {
                        statuses.push(ContainerStatus {
                            name: container["Name"].as_str().unwrap_or("unknown").to_string(),
                            status: container["State"].as_str().unwrap_or("unknown").to_string(),
                            health: container["Health"].as_str().map(|s| s.to_string()),
                        });
                    }
                }
                statuses
            }
            _ => Vec::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct DockerInstallInfo {
    pub platform: String,
    pub can_auto_install: bool,
    pub install_command: Option<String>,
    pub download_url: String,
    pub instructions: String,
}

#[derive(Debug, Clone)]
pub struct ContainerStatus {
    pub name: String,
    pub status: String,
    pub health: Option<String>,
}
