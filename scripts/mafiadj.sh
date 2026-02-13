#!/bin/bash

# mafiadj.sh - CLI wrapper for systemd service

SERVICE="mafiadj"
DIR="/opt/mafiadj"

case "$1" in
    start)
        sudo systemctl start $SERVICE
        echo "Service started."
        ;;
    stop)
        sudo systemctl stop $SERVICE
        echo "Service stopped."
        ;;
    restart)
        sudo systemctl restart $SERVICE
        echo "Service restarted."
        ;;
    status)
        sudo systemctl status $SERVICE
        ;;
    logs)
        shift
        sudo journalctl -u $SERVICE -f "$@"
        ;;
    debug)
        echo "Stopping service..."
        sudo systemctl stop $SERVICE
        echo "Starting in debug mode (Ctrl+C to exit)..."
        cd $DIR
        # Run with sudo -u mafiadj to match user permissions
        sudo -u mafiadj LOG_LEVEL=debug node dist/index.js
        ;;
    update)
        echo "Updating MafiaDJ..."
        cd $DIR
        sudo -u mafiadj git pull
        sudo -u mafiadj npm install
        sudo -u mafiadj npm run build
        sudo systemctl restart $SERVICE
        echo "Update complete."
        ;;
    config)
        shift
        case "$1" in
            edit)
                sudo -u mafiadj nano $DIR/config.json
                ;;
            show)
                cat $DIR/config.json
                ;;
            secrets)
                sudo nano $DIR/.env
                ;;
            *)
                echo "Usage: mafiadj config {edit|show|secrets}"
                ;;
        esac
        ;;
    *)
        echo "Usage: mafiadj {start|stop|restart|status|logs|debug|update|config}"
        exit 1
        ;;
esac
