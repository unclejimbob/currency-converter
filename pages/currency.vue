<template>
  <div>
    <h1>Currency converter</h1>
    <NuxtLink to="/">Home</NuxtLink>
    <!-- Display the loading status of the FX currency codes fetch   -->
    <div v-if="currencyStatus === 'pending'" class="status loading blink">
      <h3>Loading FX currency codes...{{ currencyStatus }}</h3>
    </div>
    <div v-else-if="currencyError" class="status error">
      Failed to load FX currency codes: {{ currencyError.message }}
    </div>
    <br />
    <br />
    <hr />

    <!-- Section to select the from and to currencies and enter a monetary amount to convert -->
    <div>
      <!-- Dropdown with source currency -->
      <h2>Source currency</h2>
      <select
        v-if="currencyList"
        id="source-currency-select"
        v-model="sourceCurrency"
      >
        <option
          v-for="currency in currencyList"
          :key="currency.code"
          :value="currency.code"
        >
          {{ currency.name }} ({{ currency.code }})
        </option>
      </select>
    </div>
    <div>
      <!-- Dropdown with destination currency -->
      <h2>Destination currency</h2>
      <select
        v-if="currencyList"
        id="destination-currency-select"
        v-model="destinationCurrency"
      >
        <option
          v-for="currency in currencyList"
          :key="currency.code"
          :value="currency.code"
        >
          {{ currency.name }} ({{ currency.code }})
        </option>
      </select>
    </div>

    <!-- Monetary amount to convert -->
    <h2>Enter Amount</h2>
    <input
      v-model.number="monetaryAmount"
      type="number"
      placeholder="Enter amount"
      class="amount-input"
      min="0"
      step="0.01"
    />

    <!-- Message showing what is being converted  -->
    <div v-if="monetaryAmount !== null">
      <p>
        You are converting from {{ monetaryAmount }} {{ sourceCurrencyName }} to
        {{ destinationCurrencyName }}
      </p>
    </div>

    <!-- Button to fetch currency conversion data, note that this is simply to defer the load of 
     the FX conversion value/rate, the source and destination currencies from the drop down lists
     are reactive and will kick off a refresh if their values are changed. In this situation the
     'Convert' button is used simply as a method of manually refreshing the rate as it changes 
     over time -->
    <button @click="currencyConversionExecute()">Convert</button>

    <!-- Button to swap source and destination currency values 
         in order to get a working currency conversion data, some conversions only work one way        
         For example GBP -> ALL is fine but ALL -> GBP doesn't work  -->
    <button @click="swapCurrencies">Swap</button>

    <!-- Display the loading status of the FX currency conversion -->
    <div
      v-if="currencyConversionStatus === 'pending'"
      class="status loading blink"
    >
      <h3>Loading currency conversion data...please wait</h3>
    </div>
    <div v-else-if="currencyConversionError" class="status error">
      <h3>
        This currency exchange is probably not valid, please try another
        combination or swap the source and destination currencies.
      </h3>
      {{ currencyConversionError.message }}
    </div>

    <!-- Section to show the results of the FX conversion, only show when there are results and the most recent 
     fetch status is success -->
    <div v-if="typeof currencyData === 'string'" class="status error">
      <!-- This would display an information message -->
      <p>{{ currencyData }}</p>
    </div>
    <div
      v-else-if="currencyConversion && currencyConversionStatus === 'success'"
      class="status success"
    >
      <hr />
      <h3>Currency Conversion Result:</h3>
      <p>
        {{ monetaryAmount }}
        {{ sourceCurrencyName }} [{{ sourceCurrency }}] equals
        {{ (currencyData?.exchangeRate ?? 0) * monetaryAmount }}
        {{ destinationCurrencyName }} [{{ destinationCurrency }}]
      </p>
      <p>
        From: {{ currencyData?.fromCurrencyName }} ({{
          currencyData?.fromCurrencyCode
        }})
      </p>
      <p>
        To: {{ currencyData?.toCurrencyName }} ({{
          currencyData?.toCurrencyCode
        }})
      </p>
      <p>Exchange Rate: {{ currencyData?.exchangeRate ?? 0 }}</p>
      <p>Last Refreshed: {{ currencyData?.lastRefreshed }}</p>
      <p>
        Converted Amount:
        {{ (currencyData?.exchangeRate ?? 0) * monetaryAmount }}
      </p>
      <hr />
    </div>
  </div>
</template>

<script setup lang="ts">
// Define some interfaces that make life easier
// This interface is how I would like to refer to FX currency exchange properties from the currency exchange response
interface CurrencyExchangeRate {
  fromCurrencyCode: string;
  fromCurrencyName: string;
  toCurrencyCode: string;
  toCurrencyName: string;
  exchangeRate: number;
  lastRefreshed: string;
  timeZone: string;
  bidPrice: number;
  askPrice: number;
}

// This interface is how the response actually looks like when I get it from the currency exchange response
interface RawCurrencyExchangeRate {
  "1. From_Currency Code": string;
  "2. From_Currency Name": string;
  "3. To_Currency Code": string;
  "4. To_Currency Name": string;
  "5. Exchange Rate": string;
  "6. Last Refreshed": string;
  "7. Time Zone": string;
  "8. Bid Price": string;
  "9. Ask Price": string;
}

// This is the top level of the currency exchange response
interface ApiResponse {
  "Realtime Currency Exchange Rate"?: RawCurrencyExchangeRate;
  Information?: string; // For rate limit messages or other information
  Note?: string; // For rate limit messages or other information
}

// Results from a typical currency conversion API call
/*
{
  "Realtime Currency Exchange Rate":
  {
    "1. From_Currency Code": "USD",
    "2. From_Currency Name": "United States Dollar",
    "3. To_Currency Code": "AUD",
    "4. To_Currency Name": "Australian Dollar",
    "5. Exchange Rate": "1.51700000",
    "6. Last Refreshed": "2024-11-05 03:01:41",
    "7. Time Zone": "UTC",
    "8. Bid Price": "1.51690000",
    "9. Ask Price": "1.51700000"
  }
}
*/

// API key required by Alpha Vantage to use their API service
const apiKey = "W56J79935DH5DM3C";

// Record the values selected from the currency drop-down lists to use in the currency conversion

// Using useState because I'm swapping back and forth between the home page and currency page and I want to retain
// the values between navigation calls

// Default to 'GBP' because this currency easily converts to others
const sourceCurrency = useState(() => "GBP");
const destinationCurrency = useState(() => "USD"); // Default to 'USD'

// I like this, is not part of the query so won't refresh when it changes, you have to press the 'Convert'
// button if you want an updated exchange rate, but it will locally update the 'Converted amount' which is handy
const monetaryAmount = useState(() => 100); // Default to 100

// Computed property to get the name of the selected source currency
const sourceCurrencyName = computed(() => {
  // Have to do this because of the lazyFetch where FX currency code data may not yet be available
  // even though navigation to the currency page has occurred
  if (!currencyList.value || currencyList.value.length === 0) {
    return ""; // Return an empty string if there's no data (yet)
  }

  const selected = currencyList.value.find(
    (currency: { code: string }) => currency.code === sourceCurrency.value
  );
  return selected ? selected.name : ""; // Return the currency name or an empty string
});

// Computed property to get the name of the selected destination currency
const destinationCurrencyName = computed(() => {
  // Have to do this because of the lazyFetch where FX currency code data may not yet be available
  // even though navigation to the currency page has occurred
  if (!currencyList.value || currencyList.value.length === 0) {
    return ""; // Return an empty string if there's no data (yet)
  }

  const selected = currencyList.value.find(
    (currency: { code: string }) => currency.code === destinationCurrency.value
  );
  return selected ? selected.name : ""; // Return the currency name or an empty string
});

// For storing/retrieving local payload
const nuxtApp = useNuxtApp();

// Fetch currencies - just once
const urlCurrencyList = "https://www.alphavantage.co/physical_currency_list/";

// Load the list of foreign currency codes we can select from
const {
  data: currencyList,
  status: currencyStatus,
  error: currencyError,
} = await useLazyFetch(urlCurrencyList, {
  // https://www.youtube.com/watch?v=aQPR0xn-MMk
  getCachedData(key) {
    return nuxtApp.payload.data[key] || nuxtApp.static.data[key];
  },
  transform: async (response: Response) => {
    console.log("Fetching currencies from the Alpha Vantage CSV...");
    const csvData = await response.text();

    // Split CSV into rows
    const rows = csvData.trim().split("\n");

    // Map remaining rows to an array of objects based on headers
    return rows
      .slice(1) // skip the header row
      .map((row) => {
        const values = row.split(",");

        // Match columns to headers and return as an object
        return {
          code: values[0]?.trim(), // Currency code
          name: values[1]?.trim(), // Currency name
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by 'name'
  },
});

// Computed property to return the currency exchange response destructured into something more useful
// with appropriate data types in place, have to handle differenr response formats :(
const currencyData = computed<CurrencyExchangeRate | null | string>(() => {
  const rawData = currencyConversion.value;

  // Check if the response contains the 'usual' data format
  if (rawData?.["Realtime Currency Exchange Rate"]) {
    const rateData = rawData["Realtime Currency Exchange Rate"];
    return {
      fromCurrencyCode: rateData["1. From_Currency Code"],
      fromCurrencyName: rateData["2. From_Currency Name"],
      toCurrencyCode: rateData["3. To_Currency Code"],
      toCurrencyName: rateData["4. To_Currency Name"],
      exchangeRate: parseFloat(rateData["5. Exchange Rate"]),
      lastRefreshed: rateData["6. Last Refreshed"],
      timeZone: rateData["7. Time Zone"],
      bidPrice: parseFloat(rateData["8. Bid Price"]),
      askPrice: parseFloat(rateData["9. Ask Price"]),
    };
  }

  // Check if the response contains an information message (e.g., rate limit message)
  else if (rawData?.Information) {
    return rawData.Information; // Return this as an error message to display
  }

  // Check if the response contains a rate limit note
  else if (rawData?.Note) {
    return rawData.Note;
  }

  // If neither format is matched, return null
  return null;
});

// This fetch is deferred until we press a button...or until a reactive var changes, using params rather than dynamic URL
// because it looks a bit cleaner to me
const {
  data: currencyConversion,
  execute: currencyConversionExecute,
  status: currencyConversionStatus,
  error: currencyConversionError,
} = await useFetch<ApiResponse>("query", {
  immediate: false,
  method: "GET",
  baseURL: "https://www.alphavantage.co",
  params: {
    function: "CURRENCY_EXCHANGE_RATE",
    from_currency: sourceCurrency,
    to_currency: destinationCurrency,
    apikey: apiKey,
  },
  timeout: 3000, // Have to do this because sometimes it never returns, not sure what the timeout value is at their end
});

// Swap currenncies in the event that a conversion isn't valid, this happens quite a lot unless we use major/well known
// currencies. e.g. try getting someone to convert Sri Lankan Rupee into Armenian Dram - never gonna happen :)
const swapCurrencies = () => {
  const temp = sourceCurrency.value;
  sourceCurrency.value = destinationCurrency.value;
  destinationCurrency.value = temp;
};
</script>

<!-- Some colours and behaviours -->
<style scoped>
.status {
  margin-bottom: 1em;
}
.loading {
  color: blue;
}
.error {
  color: red;
}
.success {
  color: green;
}

@keyframes blink-animation {
  to {
    opacity: 0;
  }
}

.blink {
  animation: blink-animation 1s steps(2, start) infinite;
}
</style>
