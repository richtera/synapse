function subscribeToUPLogin() {
  $("#up-login-button").on("click", async () => {
    // Request an asubscriptToUPLogin();ccount
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    // check if any number of accounts was returned
    // IF go to the dashboard
    if (accounts.length) {
      try {
        const Web3Token = window["web3-token"];
        const web3 = new Web3(window.ethereum);
        // getting address from which we will sign message
        const addresses = await web3.eth.getAccounts();
        console.log("addresses", addresses);
        const address = addresses[0];

        // generating a token with 1 day of expiration time
        const token = await Web3Token.sign(async (msg) => {
          try {
            let sig;
            try {
              sig = await web3.eth.sign(msg, address);
            } catch (err) {
              sig = await web3.eth.personal.sign(msg, address);
            }

            return typeof sig === "string" ? sig : sig.signature;
          } catch (err) {
            console.error(">>> catch", err);
          }
        }, "1d");
        console.log("signature", { token, address });
        fetch("http://127.0.0.1:8008/_matrix/client/api/v1/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "web3.signature",
            user: `@${address}:localhost`,
            password: token,
          }),
        })
          .then((request) => {
            if (request.status !== 200) {
              console.log(request.status);
              return;
            }
            return request.json();
          })
          .then((data) => {
            console.log(data);
          });
      } catch (err) {
        console.error(">>> catch", err);
      }
    } else alert("No account was selected!");
  });
}

subscribeToUPLogin();
