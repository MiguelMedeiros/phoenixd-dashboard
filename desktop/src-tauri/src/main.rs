// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod process_manager;

use process_manager::ProcessManager;
use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Manager,
};

struct AppState {
    process_manager: Mutex<ProcessManager>,
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

            // Start services
            println!("\n⚡ Starting Phoenixd Dashboard...");
            let mut process_manager = ProcessManager::new(resource_dir.clone(), data_dir.clone());
            
            if let Err(e) = process_manager.start_all() {
                eprintln!("❌ Failed to start services: {}", e);
            } else {
                println!("✅ Services started!");
            }

            // Store state
            app.manage(AppState {
                process_manager: Mutex::new(process_manager),
            });

            // Build simple tray menu
            let open_dashboard = MenuItemBuilder::with_id("open", "Open Dashboard")
                .build(app)?;
            
            let separator1 = PredefinedMenuItem::separator(app)?;

            let restart = MenuItemBuilder::with_id("restart", "Restart")
                .build(app)?;
            
            let quit = MenuItemBuilder::with_id("quit", "Quit")
                .build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&open_dashboard)
                .item(&separator1)
                .item(&restart)
                .item(&quit)
                .build()?;

            // Load tray icon
            let icon_bytes = include_bytes!("../icons/32x32.png");
            let icon = Image::from_bytes(icon_bytes)
                .expect("Failed to load tray icon");

            let _tray = TrayIconBuilder::with_id("main")
                .icon(icon)
                .menu(&menu)
                .tooltip("Phoenixd Dashboard")
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "open" => {
                            let _ = open::that("http://localhost:3000");
                        }
                        "restart" => {
                            if let Some(state) = app.try_state::<AppState>() {
                                let mut pm = state.process_manager.lock().unwrap();
                                println!("🔄 Restarting services...");
                                pm.stop_all();
                                if let Err(e) = pm.start_all() {
                                    eprintln!("❌ Failed: {}", e);
                                } else {
                                    println!("✅ Services restarted!");
                                }
                            }
                        }
                        "quit" => {
                            if let Some(state) = app.try_state::<AppState>() {
                                let mut pm = state.process_manager.lock().unwrap();
                                println!("👋 Shutting down...");
                                pm.stop_all();
                            }
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Print startup banner
            println!("\n╔════════════════════════════════════════════════╗");
            println!("║  ⚡ Phoenixd Dashboard (Desktop Edition)       ║");
            println!("╠════════════════════════════════════════════════╣");
            println!("║  ✅ Lightning Node: Running                    ║");
            println!("║  ℹ️  Tor/Tailscale/CF: Desktop version only    ║");
            println!("╠════════════════════════════════════════════════╣");
            println!("║  📍 Dashboard: http://localhost:3000           ║");
            println!("╚════════════════════════════════════════════════╝\n");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
