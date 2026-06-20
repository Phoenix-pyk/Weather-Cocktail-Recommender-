
const http = require('http'); 
const https = require('https'); 
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');


const PORT = 3000;
const HOSTNAME = 'localhost';
//Open Weather API
const OPENWEATHER_API_KEY = fs.readFileSync('./api-key.txt', 'utf8').trim();
const OPENWEATHER_HOSTNAME = 'api.openweathermap.org';


function fetchWeatherFromOpenWeather(city, callback) { 
  const path = `/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric`;
  const options = {
    hostname: OPENWEATHER_HOSTNAME,  
    path: path,                       
    method: 'GET',                    
    headers: {
      'User-Agent': 'CS355-Project'   
    }
  };

  console.log(`[API REQUEST] Fetching weather for: ${city}`); // console.log for readability on Server

  https.request(options, function(apiResponse) { // Sends https request on options

    let jsonData = '';

    apiResponse.on('data', function(chunk) {
      console.log(`[API RESPONSE] Received chunk (${chunk.length} bytes)`);
      jsonData += chunk.toString(); 
    });

    apiResponse.on('end', function() {
      console.log(`[API RESPONSE] Complete JSON received (${jsonData.length} bytes total)`);
      try {
        const weatherData = JSON.parse(jsonData);

        console.log(`[PARSING] Successfully parsed JSON response`);
        console.log(`[PARSING] Main object keys: ${Object.keys(weatherData).join(', ')}`);

        if (weatherData.cod !== 200 && weatherData.cod !== '200') {
          console.log(`[ERROR] API returned error code: ${weatherData.cod} - ${weatherData.message}`);
          callback(new Error(weatherData.message || 'City not found'), null);
        } else {
          console.log(`[PARSING] Extracted data - City: ${weatherData.name}, Temp: ${weatherData.main.temp}°C`);
          callback(null, weatherData);
        }
      } catch (parseError) { 
        console.log(`[ERROR] Failed to parse JSON: ${parseError.message}`);
        callback(parseError, null);
      }
    });

  // The 'error' event: fired if connection fails (network error, DNS failure, etc.)
  }).on('error', function(error) {
    console.log(`[ERROR] HTTPS request failed: ${error.message}`);
    callback(error, null);

  // .end() tells Node.js to send the request and close the connection
  }).end();
}

function determineDrinkCategory(weatherMain, temperature) {
  // weatherMain is a string 
  // temperature is a number in Celsius
  
  if (weatherMain === 'Clear' && temperature > 25) { //Hot Clear weather
    return 'Ordinary Drink'; // Light, refreshing
  }
  if (weatherMain === 'Clear' && temperature <= 10) { //Cold Clear weather 
    return 'Cocktail'; // Warming for cold clear days
  }
  if (weatherMain === 'Clouds') { //  Cloudy weather 
    return 'Ordinary Drink'; // Neutral, go light
  }
  if (weatherMain === 'Rain' || weatherMain === 'Drizzle') { //Rain and Drizzle
    return 'Cocktail'; // Comforting/warming
  }
  if (weatherMain === 'Snow') { //Snow and blizzard weather 
    return 'Punch / Party Drink'; // Festive, warming
  }
  if (weatherMain === 'Thunderstorm') { // Intense weather 
    return 'Cocktail'; // Strong for dramatic weather
  }
  
  // Default for anything else
  return 'Ordinary Drink';
}

function fetchDrinkFromCocktailDB(category, callback) {
  // category is a string like "Cocktail" or "Ordinary Drink"
  // CocktailDB has a free API endpoint that filters by category
  
  const path = `/api/json/v1/1/filter.php?c=${encodeURIComponent(category)}`;
  const options = {
    hostname: 'www.thecocktaildb.com',
    path: path,
    method: 'GET',
    headers: {
      'User-Agent': 'CS355-Project'
    }
  };

  console.log(`[API REQUEST] Fetching drinks in category: ${category}`); //Log request 

  https.request(options, function(apiResponse) {

    let jsonData = '';

    apiResponse.on('data', function(chunk) {
      console.log(`[API RESPONSE] Received chunk (${chunk.length} bytes)`);
      jsonData += chunk.toString();
    });

    apiResponse.on('end', function() {
      console.log(`[API RESPONSE] Complete JSON received (${jsonData.length} bytes total)`);
      try {
        const drinkResponse = JSON.parse(jsonData);
        console.log(`[PARSING] Successfully parsed CocktailDB response`); // Log parsing

        if (!drinkResponse.drinks || drinkResponse.drinks.length === 0) {
          console.log(`[ERROR] No drinks found for category: ${category}`);
          callback(new Error('No drinks found for this category'), null);
        } else {
          const drinks = drinkResponse.drinks;
          const randomIndex = Math.floor(Math.random() * drinks.length); //picks a random from the drinks
          const drink = drinks[randomIndex];
          console.log(`[PARSING] Selected drink: ${drink.strDrink} (index ${randomIndex} of ${drinks.length})`);
          callback(null, drink);
        }
      } catch (parseError) {
        console.log(`[ERROR] Failed to parse JSON: ${parseError.message}`);
        callback(parseError, null);
      }
    });

  }).on('error', function(error) {
    console.log(`[ERROR] HTTPS request failed: ${error.message}`);
    callback(error, null);

  }).end();
}

function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true); //Parse the request URL to extract the path name
  const pathname = parsedUrl.pathname;
  const method = req.method;

  console.log(`[${new Date().toISOString()}] ${method} ${pathname}`);

  

  if (method === 'GET' && pathname === '/') { //User visits the home page using GET method 
    const htmlForm = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Weather-Cocktail Recommender</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; }
          form { display: flex; flex-direction: column; gap: 10px; }
          input { padding: 8px; font-size: 16px; }
          button { padding: 10px; font-size: 16px; background-color: #007bff; color: white; border: none; cursor: pointer; }
          button:hover { background-color: #0056b3; }
        </style>
      </head>
      <body>
        <h1>Weather-based cocktail recommendation</h1>
        <p>Enter a city name to get recommendations:</p>
        <form method="POST" action="/recommend">
          <input type="text" name="city" placeholder="e.g., New York" required>
          <button type="submit">Get Recommendations</button>
        </form>
      </body>
      </html>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(htmlForm);
    return;
  }

  if (method === 'POST' && pathname === '/recommend') { //User Submits the form 
    let body = '';
    req.on('data', function(chunk) { // Event: 'data' fires when a chunk of request body is received
      body += chunk.toString();
      if (body.length > 1e6) { // Data recieved too big? 
        req.connection.destroy(); 
      }
    });


    req.on('end', function() {
      const parsedData = querystring.parse(body);
      const city = parsedData.city || 'Unknown';

      console.log(`[SUBMISSION] City received: ${city}`); //Log city
        
        fetchWeatherFromOpenWeather(city, function(error, weatherData) { // Callback weather function
        if (error) { // Check if the API request failed
          console.log(`[ERROR HANDLING] Failed to fetch weather: ${error.message}`);

          const errorHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Error</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; }
                .error { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; color: #721c24; }
                a { display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
              </style>
            </head>
            <body>
              <h1>Error</h1>
              <div class="error">
                <p><strong>Failed to fetch weather data:</strong></p>
                <p>${error.message}</p>
                <p>Make sure you entered a valid city name and configured your API key.</p>
              </div>
              <a href="/">← Try Again</a>
            </body>
            </html>
          `;
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(errorHtml);
          return;
        }
        // API successful 
        const cityName = weatherData.name;                    // City name
        const temperature = weatherData.main.temp;            // Temperature in Celsius
        const weatherDesc = weatherData.weather[0].description; // Weather description
        const weatherMain = weatherData.weather[0].main;      // Weather category, example: clouds
        console.log(`[DATA EXTRACTION] City: ${cityName}, Temp: ${temperature}°C, Condition: ${weatherMain}`); //Log Data Extraction

        const drinkCategory = determineDrinkCategory(weatherMain, temperature); 
        console.log(`[CATEGORY] Selected drink category: ${drinkCategory}`); // Log drink category

        fetchDrinkFromCocktailDB(drinkCategory, function(drinkError, drinkData){
          if (drinkError){ //If drink API fails
            console.log(`[ERROR HANDLING] Failed to fetch drink: ${drinkError.message}`); //Log error
            // Respond with Weather only 
            const weatherOnlyHtml = `
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Weather for ${cityName}</title>
                <style>
                  body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; }
                  .weather-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin: 20px 0; }
                  .temp { font-size: 48px; font-weight: bold; }
                  .description { font-size: 20px; margin-top: 10px; text-transform: capitalize; }
                  .info { margin-top: 15px; line-height: 1.8; }
                  .error-note { background-color: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 5px; color: #856404; margin-top: 20px; }
                  a { display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
                  a:hover { background-color: #0056b3; }
                </style>
              </head>
              <body>
                <h1>Weather Information</h1>
                <div class="weather-card">
                  <h2>${cityName}</h2>
                  <div class="temp">${temperature}&deg;C</div>
                  <div class="description">${weatherDesc}</div>
                  <div class="info">
                    <p><strong>Condition:</strong> ${weatherMain}</p>
                  </div>
                </div>
                <div class="error-note">
                  <p><strong>Note:</strong> Could not fetch drink recommendation (${drinkError.message})</p>
                </div>
                <a href="/">← Back to Form</a>
              </body>
              </html>
            `;
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(weatherOnlyHtml);
    return;
  }
        // Both weather and drink fetch successful
      const drinkName = drinkData.strDrink;
      const drinkImage = drinkData.strDrinkThumb;
      console.log(`[SUCCESS] Have both weather and drink data. Sending combined response.`); // Log Success
      // Respond with weather and cocktail
      const combinedHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Weather & Drink for ${cityName}</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; }
                .weather-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin: 20px 0; }
                .drink-card { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; border-radius: 10px; margin: 20px 0; }
                .temp { font-size: 48px; font-weight: bold; }
                .description { font-size: 20px; margin-top: 10px; text-transform: capitalize; }
                .info { margin-top: 15px; line-height: 1.8; }
                .drink-image { max-width: 200px; border-radius: 10px; margin-top: 15px; }
                a { display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
                a:hover { background-color: #0056b3; }
              </style>
            </head>
            <body>
              <h1>Weather & Drink Recommendation</h1>

              <div class="weather-card">
                <h2>${cityName}</h2>
                <div class="temp">${temperature}&deg;C</div>
                <div class="description">${weatherDesc}</div>
                <div class="info">
                  <p><strong>Condition:</strong> ${weatherMain}</p>
                </div>
              </div>

              <div class="drink-card">
                <h2>Recommended Drink</h2>
                <p><strong>Drink:</strong> ${drinkName}</p>
                <p><strong>Category:</strong> ${drinkCategory}</p>
                <img src="${drinkImage}" alt="${drinkName}" class="drink-image">
              </div>

              <a href="/">← Back to Form</a>
            </body>
            </html>
          `;
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(combinedHtml);
        });
      });
    });

    return;
  }

  const html404 = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>404 Not Found</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; text-align: center; }
        h1 { color: #d32f2f; }
      </style>
    </head>
    <body>
      <h1>404 - Page Not Found</h1>
      <p>The requested path <code>${pathname}</code> does not exist.</p>
      <a href="/">← Go Home</a>
    </body>
    </html>
  `;

  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html404);
}

const server = http.createServer(handleRequest);

server.listen(PORT, HOSTNAME, function() {
  console.log(`Server running at http://${HOSTNAME}:${PORT}/`);
});