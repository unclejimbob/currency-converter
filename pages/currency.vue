<template>
  <div>
    <h1>Currency converter</h1>
    <NuxtLink to="/">Home</NuxtLink>
    <div v-if="currencyStatus === 'pending'" class="status loading blink">
      <h3>Loading currency data...{{ currencyStatus }}</h3>
    </div>
    <div v-else-if="currencyError" class="status error">
      Failed to load data: {{ currencyError.message }}
    </div>
    <br />
    <br />
    <hr />
    <div>
      <!-- Dropdown with source currency -->
      <h2>Source currency</h2>
      <select
        v-if="currencyList"
        v-model="sourceCurrency"
        id="source-currency-select"
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
        v-model="destinationCurrency"
        id="destination-currency-select"
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

    <h2>Enter Amount</h2>
    <input
      type="number"
      v-model.number="monetaryAmount"
      placeholder="Enter amount"
      class="amount-input"
      min="0"
      step="0.01"
    />

    <div v-if="monetaryAmount !== null">
      <p>
        You are converting from {{ monetaryAmount }} {{ sourceCurrencyName }} to
        {{ destinationCurrencyName }}
      </p>
    </div>

    <!-- Button to fetch currency conversion data, note that this is simply to defer the load of 
     FX rate, the source and destination currencies from the drop down lists are reactiver and will
     kick off a refresh if their values are changed. In this situation the 'Convert' button is used
     as a way of manually refreshing the rate as it changes over time -->
    <button @click="currencyConversionExecute">Convert</button>

    <!-- Button to swap source and destination currency values 
         in order to get a working currency conversion data, some conversions only work one way        
         For example GBP -> ALL is fine but ALL -> GBP doesn't work  -->
    <button @click="swapCurrencies">Swap</button>

    <div
      v-if="currencyConversionStatus === 'pending'"
      class="status loading blink"
    >
      <h3>Loading currency conversion data...{{ currencyConversionStatus }}</h3>
    </div>
    <div v-else-if="currencyConversionError" class="status error">
      <h3>
        This currency exchange is probably not valid, please try another
        combination or swap the source and destination currencies.
      </h3>

      {{ currencyConversionError.message }}
    </div>

    <div v-if="currencyConversion">
      <hr />
      <h3>Currency Conversion Result:</h3>
      <!-- There must be a more elegant way to do this using dot notation to specify attributes of an object but I don't know how -->
      <p>
        From:
        {{
          currencyConversion["Realtime Currency Exchange Rate"][
            "2. From_Currency Name"
          ]
        }}
        ({{
          currencyConversion["Realtime Currency Exchange Rate"][
            "1. From_Currency Code"
          ]
        }})
      </p>
      <p>
        To:
        {{
          currencyConversion["Realtime Currency Exchange Rate"][
            "4. To_Currency Name"
          ]
        }}
        ({{
          currencyConversion["Realtime Currency Exchange Rate"][
            "3. To_Currency Code"
          ]
        }})
      </p>
      <p>
        Exchange Rate:
        {{
          currencyConversion["Realtime Currency Exchange Rate"][
            "5. Exchange Rate"
          ]
        }}
      </p>
      <p>
        Last Refreshed:
        {{
          currencyConversion["Realtime Currency Exchange Rate"][
            "6. Last Refreshed"
          ]
        }}
      </p>
      <p>
        Converted amount:
        {{
          currencyConversion["Realtime Currency Exchange Rate"][
            "5. Exchange Rate"
          ] * monetaryAmount
        }}
      </p>
      <hr />
    </div>
  </div>
</template>

<script setup lang="ts">
// Results from the currency conversion API call
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

// API key
const apiKey = "O90Q3N2XJ5EFMT18";

// Record the values selected from the currency drop-down lists to use use in the currency conversion

// Using useState because I'm swapping back and forth between the home page and currency page and I want to retain
// the values between navigation calls

// Default to 'GBP' because this currency easily converts to others
const sourceCurrency = useState("sourceCurrency", () => "GBP");
const destinationCurrency = useState("destinationCurrency", () => "USD"); // Default to 'NZD'

// I like this, is not part of the query so won't refresh when it changes, you have to press the 'Convert'
// button if you want an updated exchange rate, but it will locally update the 'Converted amount' which is handy
const monetaryAmount = useState("monetaryAmount", () => 100); // Default to 100

// Computed property to get the name of the selected source currency
const sourceCurrencyName = computed(() => {
  // Have to do this because of the lazyfetch where data may not yet be available even though nvigation
  // has occurred
  if (!currencyList.value || currencyList.value.length === 0) {
    return ""; // Return an empty string if there's no data
  }

  const selected = currencyList.value.find(
    (currency) => currency.code === sourceCurrency.value
  );
  return selected ? selected.name : ""; // Return the currency name or an empty string
});

// Computed property to get the name of the selected destination currency
const destinationCurrencyName = computed(() => {
  // Have to do this because of the lazyfetch where data may not yet be available even though nvigation
  // has occurred
  if (!currencyList.value || currencyList.value.length === 0) {
    return ""; // Return an empty string if there's no data
  }

  const selected = currencyList.value.find(
    (currency) => currency.code === destinationCurrency.value
  );
  return selected ? selected.name : ""; // Return the currency name or an empty string
});

const nuxtApp = useNuxtApp();

// Fetch currencies - just once
const urlCurrencyList = "https://www.alphavantage.co/physical_currency_list/";
const {
  data: currencyList,
  status: currencyStatus,
  error: currencyError,
} = await useLazyFetch(urlCurrencyList, {
  // https://www.youtube.com/watch?v=aQPR0xn-MMk
  getCachedData(key) {
    return nuxtApp.payload.data[key] || nuxtApp.static.data[key];
  },
  transform: async (response) => {
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

// I like interfaces, I just can't see how to use them properly here
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

interface ApiResponse {
  "Realtime Currency Exchange Rate": CurrencyExchangeRate;
}

// This fetch is deferred until we press a button...or until a reactive var changes
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
  timeout: 5000, // Have to do this because sometimes it never returns, not sue what the timeout value is at their end
});

const swapCurrencies = () => {
  const temp = sourceCurrency.value;
  sourceCurrency.value = destinationCurrency.value;
  destinationCurrency.value = temp;
};
</script>

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
