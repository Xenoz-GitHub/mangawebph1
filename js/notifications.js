// js/notifications.js
window.Notifications = {
    container: null,

    init: function() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'notification-container';
            this.container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(this.container);
        }
    },

    show: function(message, type = 'info', duration = 5000) {
        this.init();

        const colors = {
            success: '#00b894',
            error: '#d63031',
            warning: '#fdcb6e',
            info: '#0984e3'
        };

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const notification = document.createElement('div');
        notification.style.cssText = `
            background: ${colors[type] || colors.info};
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 300px;
            max-width: 400px;
            animation: slideIn 0.3s ease;
            cursor: pointer;
        `;

        notification.innerHTML = `
            <i class="fas ${icons[type] || icons.info}"></i>
            <span style="flex: 1;">${message}</span>
            <i class="fas fa-times" style="cursor: pointer; opacity: 0.7;" onclick="this.parentElement.remove()"></i>
        `;

        this.container.appendChild(notification);

        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, duration);
        }

        return notification;
    },

    success: function(message, duration = 5000) {
        return this.show(message, 'success', duration);
    },

    error: function(message, duration = 5000) {
        return this.show(message, 'error', duration);
    },

    warning: function(message, duration = 5000) {
        return this.show(message, 'warning', duration);
    },

    info: function(message, duration = 5000) {
        return this.show(message, 'info', duration);
    }
};

// Add animation style
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);