// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod docker_manager;
mod process_manager;

use docker_manager::DockerManager;
use process_manager::ProcessManager;
use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Manager,
};

#[derive(Clone, PartialEq)]
enum RunMode {
    Docker,  // Everything via Docker
    Local,   // Everything local (fallback)
}

struct AppState {
    process_manager: Mutex<Option<ProcessManager>>,
    docker_manager: Mutex<DockerManager>,
    run_mode: Mutex<RunMode>,
    data_dir: std::path::PathBuf,
    resource_dir: std::path::PathBuf,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let resource_dir = app
                .path()
                .resource_dir()
                .expect("Failed to get resource directory");

            let data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            std::fs::create_dir_all(&data_dir).expect("Failed to create data directory");

            println!("📂 Resource directory: {:?}", resource_dir);
            println!("📂 Data directory: {:?}", data_dir);

            // Initialize Docker manager
            let docker_manager = DockerManager::new(resource_dir.clone());
            let docker_available = docker_manager.is_docker_available();
            let docker_installed = docker_manager.is_docker_installed();

            println!("🐳 Docker installed: {}, running: {}", docker_installed, docker_available);

            let run_mode: RunMode;
            let mut process_manager: Option<ProcessManager> = None;

            if docker_available {
                // Docker is available - use it for everything!
                println!("\n🐳 Starting in DOCKER MODE (full features)...");
                match docker_manager.start_containers() {
                    Ok(_) => {
                        run_mode = RunMode::Docker;
                        println!("✅ Docker containers started!");
                    }
                    Err(e) => {
                        eprintln!("⚠️ Docker failed: {}", e);
                        println!("⚡ Falling back to LOCAL MODE...");
                        let mut pm = ProcessManager::new(resource_dir.clone(), data_dir.clone());
                        if let Err(e) = pm.start_all() {
                            eprintln!("Failed to start local services: {}", e);
                        }
                        process_manager = Some(pm);
                        run_mode = RunMode::Local;
                    }
                }
            } else {
                // Docker not available - run local
                if docker_installed {
                    println!("\n⚠️ Docker installed but not running");
                    println!("   Start Docker Desktop for full features (Tor, Cloudflare)");
                } else {
                    println!("\n❌ Docker not installed");
                    println!("   Install Docker for full features (Tor, Cloudflare)");
                }
                println!("\n⚡ Starting in LOCAL MODE...");
                let mut pm = ProcessManager::new(resource_dir.clone(), data_dir.clone());
                if let Err(e) = pm.start_all() {
                    eprintln!("Failed to start services: {}", e);
                }
                process_manager = Some(pm);
                run_mode = RunMode::Local;
            }

            // Store state
            let run_mode_clone = run_mode.clone();
            app.manage(AppState {
                process_manager: Mutex::new(process_manager),
                docker_manager: Mutex::new(docker_manager),
                run_mode: Mutex::new(run_mode),
                data_dir: data_dir.clone(),
                resource_dir: resource_dir.clone(),
            });

            // Build tray menu
            let open_dashboard = MenuItemBuilder::with_id("open", "🌐 Open Dashboard")
                .build(app)?;
            
            let separator1 = PredefinedMenuItem::separator(app)?;

            // Mode status
            let mode_text = match run_mode_clone {
                RunMode::Docker => "🐳 Mode: Docker (Full Features)",
                RunMode::Local => "⚡ Mode: Local (Lightning Only)",
            };
            let mode_status = MenuItemBuilder::with_id("mode_status", mode_text)
                .enabled(false)
                .build(app)?;

            let separator2 = PredefinedMenuItem::separator(app)?;

            // Services status based on mode
            let (svc1, svc2, svc3) = match run_mode_clone {
                RunMode::Docker => (
                    "✅ Lightning Node",
                    "✅ Tor Available",
                    "✅ Cloudflare Available",
                ),
                RunMode::Local => (
                    "✅ Lightning Node",
                    "❌ Tor (needs Docker)",
                    "❌ Cloudflare (needs Docker)",
                ),
            };
            
            let status1 = MenuItemBuilder::with_id("status1", svc1)
                .enabled(false)
                .build(app)?;
            let status2 = MenuItemBuilder::with_id("status2", svc2)
                .enabled(false)
                .build(app)?;
            let status3 = MenuItemBuilder::with_id("status3", svc3)
                .enabled(false)
                .build(app)?;

            let separator3 = PredefinedMenuItem::separator(app)?;

            // Docker action
            let docker_action = if docker_available {
                MenuItemBuilder::with_id("docker_action", "🔄 Restart Docker Services")
                    .build(app)?
            } else if docker_installed {
                MenuItemBuilder::with_id("docker_action", "▶️ Start Docker Desktop")
                    .build(app)?
            } else {
                MenuItemBuilder::with_id("docker_action", "📥 Install Docker...")
                    .build(app)?
            };

            let separator4 = PredefinedMenuItem::separator(app)?;

            let restart = MenuItemBuilder::with_id("restart", "🔄 Restart All")
                .build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "⏹️ Quit")
                .build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&open_dashboard)
                .item(&separator1)
                .item(&mode_status)
                .item(&separator2)
                .item(&status1)
                .item(&status2)
                .item(&status3)
                .item(&separator3)
                .item(&docker_action)
                .item(&separator4)
                .item(&restart)
                .item(&quit)
                .build()?;

            // Load tray icon
            let icon_bytes = include_bytes!("../icons/32x32.png");
            let icon = Image::from_bytes(icon_bytes)
                .expect("Failed to load tray icon");

            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .tooltip("Phoenixd Dashboard")
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "open" => {
                            let _ = open::that("http://localhost:3000");
                        }
                        "docker_action" => {
                            if let Some(state) = app.try_state::<AppState>() {
                                let dm = state.docker_manager.lock().unwrap();
                                
                                if dm.is_docker_available() {
                                    // Restart Docker services
                                    let _ = dm.stop_containers();
                                    match dm.start_containers() {
                                        Ok(_) => println!("✅ Docker services restarted!"),
                                        Err(e) => eprintln!("❌ Failed: {}", e),
                                    }
                                } else if dm.is_docker_installed() {
                                    // Open Docker Desktop
                                    #[cfg(target_os = "macos")]
                                    let _ = open::that("/Applications/Docker.app");
                                    #[cfg(target_os = "windows")]
                                    let _ = std::process::Command::new("cmd")
                                        .args(["/C", "start", "Docker Desktop"])
                                        .spawn();
                                    #[cfg(target_os = "linux")]
                                    let _ = std::process::Command::new("systemctl")
                                        .args(["--user", "start", "docker-desktop"])
                                        .spawn();
                                    println!("📍 Opening Docker Desktop...");
                                    println!("   Restart the app after Docker starts for full features");
                                } else {
                                    // Install Docker
                                    let info = dm.get_install_info();
                                    println!("\n📦 Docker Installation\n");
                                    println!("Platform: {}", info.platform);
                                    println!("{}\n", info.instructions);
                                    let _ = open::that(&info.download_url);
                                }
                            }
                        }
                        "restart" => {
                            if let Some(state) = app.try_state::<AppState>() {
                                restart_all(&state);
                            }
                        }
                        "quit" => {
                            if let Some(state) = app.try_state::<AppState>() {
                                shutdown_all(&state);
                            }
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Print startup banner
            println!("\n╔════════════════════════════════════════════════════╗");
            match run_mode_clone {
                RunMode::Docker => {
                    println!("║  🐳 Phoenixd Dashboard (Docker Mode)              ║");
                    println!("╠════════════════════════════════════════════════════╣");
                    println!("║  ✅ Lightning Node                                 ║");
                    println!("║  ✅ Tor Hidden Service                             ║");
                    println!("║  ✅ Cloudflare Tunnel                              ║");
                }
                RunMode::Local => {
                    println!("║  ⚡ Phoenixd Dashboard (Local Mode)                ║");
                    println!("╠════════════════════════════════════════════════════╣");
                    println!("║  ✅ Lightning Node                                 ║");
                    println!("║  ❌ Tor (start Docker for this)                    ║");
                    println!("║  ❌ Cloudflare (start Docker for this)             ║");
                }
            }
            println!("╠════════════════════════════════════════════════════╣");
            println!("║  📍 Dashboard: http://localhost:3000               ║");
            println!("╚════════════════════════════════════════════════════╝\n");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn restart_all(state: &AppState) {
    println!("🔄 Restarting all services...");
    
    let run_mode = state.run_mode.lock().unwrap().clone();
    
    match run_mode {
        RunMode::Docker => {
            let dm = state.docker_manager.lock().unwrap();
            let _ = dm.stop_containers();
            match dm.start_containers() {
                Ok(_) => println!("✅ Docker services restarted"),
                Err(e) => eprintln!("❌ Failed: {}", e),
            }
        }
        RunMode::Local => {
            if let Some(pm) = state.process_manager.lock().unwrap().as_mut() {
                pm.stop_all();
                if let Err(e) = pm.start_all() {
                    eprintln!("❌ Failed: {}", e);
                } else {
                    println!("✅ Local services restarted");
                }
            }
        }
    }
}

fn shutdown_all(state: &AppState) {
    println!("👋 Shutting down...");
    
    let run_mode = state.run_mode.lock().unwrap().clone();
    
    match run_mode {
        RunMode::Docker => {
            let dm = state.docker_manager.lock().unwrap();
            let _ = dm.stop_containers();
        }
        RunMode::Local => {
            if let Some(pm) = state.process_manager.lock().unwrap().as_mut() {
                pm.stop_all();
            }
        }
    }
    
    println!("✅ Goodbye!");
}
