// Platform Links - wrapped in DOMContentLoaded to ensure elements exist
document.addEventListener('DOMContentLoaded', function() {
    const tiktokLink = document.getElementById('tiktok-link');
    const ebayLink = document.getElementById('ebay-link');

    // Replace these with your actual TikTok Shop and eBay URLs
    if (tiktokLink) {
        tiktokLink.href = 'https://www.tiktok.com/shop';
    }
    if (ebayLink) {
        ebayLink.href = 'https://www.ebay.co.uk/usr/ayz1x_yarn';
    }
});

// Contact Form Handling
document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(this);
            const name = formData.get('name');
            const email = formData.get('email');
            const message = formData.get('message');
            
            // Here you would typically send this data to a server
            // For now, we'll just show an alert
            alert('Thank you for your message! We will get back to you soon.');
            
            // Reset the form
            this.reset();
        });
    }
});

// Theme Toggle Functionality - Global function to work on all pages
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    if (!themeToggle) {
        console.error('Theme toggle not found');
        return;
    }

    // Check for saved theme preference or default to 'light'
    const currentTheme = localStorage.getItem('theme') || 'light';
    body.setAttribute('data-theme', currentTheme);

    // Update toggle switch position based on current theme
    if (currentTheme === 'dark') {
        themeToggle.classList.add('active');
    }

    // Theme toggle event listener
    themeToggle.addEventListener('click', function() {
        console.log('Theme toggle clicked'); // Debug log
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Toggle switch animation
        this.classList.toggle('active');
        
        console.log('Theme changed to:', newTheme); // Debug log
    });
}

// Initialize theme toggle on all pages
document.addEventListener('DOMContentLoaded', initThemeToggle);

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Mobile Menu Toggle
function initMobileMenu() {
    const toggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    if (!toggle || !navLinks) return;

    function closeMenu() {
        navLinks.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = navLinks.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close when clicking a nav link (for one-page UX)
    navLinks.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') {
            closeMenu();
        }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!navLinks.contains(e.target) && e.target !== toggle) {
            closeMenu();
        }
    });
}

document.addEventListener('DOMContentLoaded', initMobileMenu);
