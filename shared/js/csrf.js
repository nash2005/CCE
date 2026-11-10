/**
 * CSRF Protection for frontend.
 * Fetches the CSRF token from the server and attaches it to all Axios POST requests.
 */
(function() {
  var csrfToken = '';

  // Fetch token from server
  axios.get('/REQUEST/login/api/csrf_token.php')
    .then(function(res) {
      if (res.data && res.data.token) {
        csrfToken = res.data.token;
      }
    })
    .catch(function() {
      // Silent fail — token will be empty, server will reject POST
    });

  // Axios interceptor: attach CSRF token to every POST request
  axios.interceptors.request.use(function(config) {
    if (config.method === 'post' || config.method === 'POST') {
      // Set as header (works for both JSON and FormData)
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    return config;
  });

  // Expose getter for manual use
  window.getCsrfToken = function() {
    return csrfToken;
  };
})();
