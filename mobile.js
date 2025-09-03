// Mobile detection and optimization
function initializeMobile() {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        // Add class for mobile-specific styling
        document.body.classList.add('mobile');
        console.log('Mobile device detected');
        
        // Show mobile color picker when in game
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                if (document.body.classList.contains('mobile-single-slot')) {
                    const colorPicker = document.getElementById('mobile-color-picker');
                    colorPicker.classList.add('visible');
                }
            }, 1000);
        });
    }
}