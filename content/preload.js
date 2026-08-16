/**
 * Full Page Screenshot Pro - Lazy Load Preloader Script
 * Injected into the active tab to force images and deferred content to load before capturing.
 */

(() => {
  return new Promise((resolve) => {
    try {
      const originalScrollX = window.scrollX || window.pageXOffset || 0;
      const originalScrollY = window.scrollY || window.pageYOffset || 0;

      const totalHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.documentElement.clientHeight
      );

      const viewportHeight = window.innerHeight || 800;
      const step = Math.max(viewportHeight * 0.75, 400);
      let currentY = 0;

      // Force lazy loading attributes on all img and picture elements
      const lazyImages = document.querySelectorAll('img[loading="lazy"], img[data-src], img[data-lazy-src], [data-bg]');
      lazyImages.forEach((img) => {
        if (img.getAttribute('loading') === 'lazy') {
          img.setAttribute('loading', 'eager');
        }
        const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
        if (dataSrc && !img.getAttribute('src')) {
          img.setAttribute('src', dataSrc);
        }
      });

      function scrollNext() {
        if (currentY < totalHeight) {
          window.scrollTo({
            top: currentY,
            left: 0,
            behavior: 'instant'
          });

          window.dispatchEvent(new Event('scroll'));
          window.dispatchEvent(new Event('resize'));

          currentY += step;
          setTimeout(scrollNext, 120);
        } else {
          // Reached bottom, scroll to bottom once
          window.scrollTo(0, totalHeight);
          
          setTimeout(() => {
            // Restore to original scroll position smoothly
            window.scrollTo({
              top: originalScrollX,
              left: originalScrollY,
              behavior: 'instant'
            });
            window.dispatchEvent(new Event('scroll'));
            
            setTimeout(() => {
              resolve({
                success: true,
                totalHeight: totalHeight,
                width: document.documentElement.scrollWidth || window.innerWidth
              });
            }, 150);
          }, 300);
        }
      }

      scrollNext();
    } catch (err) {
      resolve({
        success: false,
        error: err.message || 'Error during lazy-load preloading'
      });
    }
  });
})();
