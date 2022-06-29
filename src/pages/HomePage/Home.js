import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { connectWallet } from "../../redux/blockchain/blockchainActions";
import { fetchData } from "./../../redux/data/dataActions";
import * as s from "./../../styles/globalStyles";
import Loader from "../../components/Loader/loader";

const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const web3 = createAlchemyWeb3(
  "https://eth-rinkeby.alchemyapi.io/v2/pBY3syVarS-tO2ZAQlA3uWBq_OqzwIDw"
);
var Web3 = require("web3");
var Contract = require("web3-eth-contract");

function Home() {
  const dispatch = useDispatch();
  const blockchain = useSelector((state) => state.blockchain);
  const data = useSelector((state) => state.data);
  const [claimingNft, setClaimingNft] = useState(false);
  const [mintDone, setMintDone] = useState(false);
  const [supply, setTotalSupply] = useState(0);
  const [supplyPublic, setTotalPublicSupply] = useState(0);
  const [supplyFree, setTotalFreeSupply] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [statusAlert, setStatusAlert] = useState("");
  const [mintAmount, setMintAmount] = useState(1);
  const [displayCost, setDisplayCost] = useState(0);
  const [state, setState] = useState(-1);
  const [nftCost, setNftCost] = useState(-1);
  const [disable, setDisable] = useState(false);
  const [max, setMax] = useState(0);
  const [loading, setLoading] = useState(true);
  const [proof, setProof] = useState([]);
  const [totalMint, setTotalMint] = useState(0);
  const [CONFIG, SET_CONFIG] = useState({
    CONTRACT_ADDRESS: "",
    SCAN_LINK: "",
    NETWORK: {
      NAME: "",
      SYMBOL: "",
      ID: 0,
    },
    NFT_NAME: "",
    SYMBOL: "",
    MAX_SUPPLY: 1,
    WEI_COST: 0,
    DISPLAY_COST: 0,
    GAS_LIMIT: 0,
    MARKETPLACE: "",
    MARKETPLACE_LINK: "",
    SHOW_BACKGROUND: false,
  });

  const claimNFTs = async () => {
    let cost = nftCost;
    cost = Web3.utils.toWei(String(cost), "ether");

    let gasLimit = CONFIG.GAS_LIMIT;
    let totalCostWei = String(cost * mintAmount);
    let totalGasLimit = String(gasLimit * mintAmount);
    setFeedback(`Minting your ${CONFIG.NFT_NAME}`);
    setClaimingNft(true);
    setLoading(true);

    // const estGas = await blockchain.smartContract.methods.
    // mint(mintAmount,proof).estimateGas({
    //   from: blockchain.account,
    //   to: CONFIG.CONTRACT_ADDRESS,
    // });
    // console.log({ estGas });

    blockchain.smartContract.methods
      .mint(mintAmount)
      .send({
        gasLimit: String(totalGasLimit),
        to: CONFIG.CONTRACT_ADDRESS,
        from: blockchain.account,
        value: totalCostWei,
      })
      .once("error", (err) => {
        console.log(err);
        setFeedback("Sorry, something went wrong please try again later.");
        setClaimingNft(false);
        setLoading(false);
      })
      .then((receipt) => {
        setLoading(false);
        setMintDone(true);
        setFeedback(`Congratulation, your mint is successful.`);
        setClaimingNft(false);
        blockchain.smartContract.methods
          .totalSupply()
          .call()
          .then((res) => {
            setTotalSupply(res);
          });
        dispatch(fetchData(blockchain.account));
        getData();
      });
  };

  const decrementMintAmount = () => {
    let newMintAmount = mintAmount - 1;
    if (newMintAmount < 1) {
      newMintAmount = 1;
    }
    setMintAmount(newMintAmount);
    setDisplayCost(parseFloat(nftCost * newMintAmount).toFixed(2));
  };

  const incrementMintAmount = () => {
    let newMintAmount = mintAmount + 1;
    newMintAmount > max ? (newMintAmount = max) : newMintAmount;
    setDisplayCost(parseFloat(nftCost * newMintAmount).toFixed(2));
    setMintAmount(newMintAmount);
  };

  const maxNfts = () => {
    setMintAmount(max);

    setDisplayCost(parseFloat(nftCost * max).toFixed(2));
  };

  const getData = async () => {
    if (blockchain.account !== "" && blockchain.smartContract !== null) {
      dispatch(fetchData(blockchain.account));
      const totalSupply = await blockchain.smartContract.methods
        .totalSupply()
        .call();
      setTotalSupply(totalSupply);
      // 0 - Pause
      // 1 - Free Mint State
      // 2 - Public
      let currentState = await blockchain.smartContract.methods
        .currentState()
        .call();
      setState(currentState);

      // Nft states
      if (currentState == 1) {
      } else {
        setFeedback(`Welcome, you can mint up to 1 NFTs per transaction`);
      }
    }
  };

  const getDataWithAlchemy = async () => {
    const abiResponse = await fetch("/config/abi.json", {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const abi = await abiResponse.json();
    var contract = new Contract(
      abi,
      "0xDe484896C9bafD02B21160bB0c314D39EAAeC030"
    );
    contract.setProvider(web3.currentProvider);
    // Get Total Supply
    const totalSupply = await contract.methods.totalSupply().call();
    setTotalSupply(totalSupply);

    // Get Contract State
    let currentState = await contract.methods.currentState().call();
    setState(currentState);

    // Set Price and Max According to State

    if (currentState == 0) {
      setStatusAlert("MINT NOT LIVE YET!");
      setDisable(true);
      setDisplayCost(0.0);
      setMax(0);
    } else if (currentState == 1) {
      let maxFree = await contract.methods.maxFree().call();
      setTotalFreeSupply(maxFree);
      if (totalSupply >= maxFree) {
        setDisable(true);
        setFeedback(`All Free Mints are used up.`);
      }

      let freeMintCost = 0.0;
      setNftCost(freeMintCost);
      setDisplayCost(freeMintCost);
      setStatusAlert("FREE MINT IS LIVE!");
    } else {
      let puCost = await contract.methods.cost().call();
      setDisplayCost(web3.utils.fromWei(puCost));
      setNftCost(web3.utils.fromWei(puCost));
      setStatusAlert("PUBLIC MINT IS LIVE!");
      let puMax = await contract.methods.maxMintAmountPublic().call();
      setMax(puMax);
    }
  };

  const getConfig = async () => {
    const configResponse = await fetch("/config/config.json", {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    const config = await configResponse.json();
    SET_CONFIG(config);
  };

  useEffect(() => {
    getConfig();
    getDataWithAlchemy();
    setTimeout(() => {
      setLoading(false);
    }, 1500);
  }, []);

  useEffect(() => {
    getData();
  }, [blockchain.account]);

  return (
    <>
      {loading && <Loader />}

      <header>
        <nav className="navbar navbar-expand-lg navbar-light bg-transparent fixed-top">
          <div className="container-fluid d-flex justify-content-end">
            <a className="social-icons" href="#">
              <img
                src={"config/images/icon-twitter.png"}
                width="50px"
                alt="twitter"
              />
            </a>
            <a className="social-icons" href="#">
              <img
                src={"config/images/icon-opensea.png"}
                width="50px"
                alt="twitter"
              />
            </a>
          </div>
        </nav>
      </header>

      <div className="hero d-flex flex-column justify-content-center">
        <div class="container  d-flex  justify-content-center">
          <a href="#mintForm">
            <button type="button" class="btn btn-success btn-lg my-4">
              Learn more
            </button>
          </a>
        </div>
      </div>

      <div className="container">
        <div className="row my-5 pt-5 g-5">
          <div className="col-lg-6 col-md-12 d-flex justify-content-center">
            <div class="mint-form" id="mintForm">
              {/* <img src="config/images/btn-mint.png" class="" /> */}
              <div>
                <div className="text-normal my-4 fs-2">Mint Price:</div>
                <div className="text-bold my-4 fs-2">FREE (gas only)</div>
              </div>
              <div>
                <div className="text-normal my-4 fs-2">Total Supply:</div>
                <div className="text-bold my-4 fs-2">{CONFIG.MAX_SUPPLY}</div>
              </div>
              <div>
                <div className="text-normal my-4 fs-2">Remaining Supply:</div>
                <div className="text-bold my-4 fs-2">
                  {CONFIG.MAX_SUPPLY - supply}
                </div>
              </div>
              <div>
                <div className="text-normal my-4 fs-2">Max 2 per wallet!</div>
              </div>
              <div>
                <s.FlexContainer jc={"center"} ai={"center"} fd={"row"}>
                  {blockchain.account !== "" &&
                  blockchain.smartContract !== null &&
                  blockchain.errorMsg === "" ? (
                    <s.Container ai={"center"} jc={"center"} fd={"row"}>
                      <s.connectButton
                        disabled={disable}
                        onClick={(e) => {
                          e.preventDefault();
                          claimNFTs();
                        }}
                      >
                        {claimingNft ? "Confirm Transaction in Wallet" : "Mint"}
                        {/* {mintDone && !claimingNft  ? feedback : ""} */}
                      </s.connectButton>{" "}
                    </s.Container>
                  ) : (
                    <>
                      {/* {blockchain.errorMsg === "" ? ( */}
                      <s.connectButton
                        style={{
                          textAlign: "center",
                          color: "#d5c97d",
                          cursor: "pointer",
                        }}
                        disabled={state == 0 ? 1 : 0}
                        onClick={(e) => {
                          e.preventDefault();
                          dispatch(connectWallet());
                          getData();
                        }}
                      >
                        Connect Wallet
                      </s.connectButton>
                      {/* ) : ("")} */}
                    </>
                  )}
                  <s.SpacerLarge />
                  {blockchain.errorMsg !== "" ? (
                    <s.connectButton
                      style={{
                        textAlign: "center",
                        color: "#d5c97d",
                        cursor: "pointer",
                      }}
                    >
                      {blockchain.errorMsg}
                    </s.connectButton>
                  ) : (
                    <s.TextDescription
                      style={{
                        textAlign: "center",
                        color: "#d5c97d",
                        cursor: "pointer",
                      }}
                    >
                      {feedback}
                    </s.TextDescription>
                  )}
                </s.FlexContainer>
              </div>
            </div>
          </div>
          <div className="col-lg-6 col-md-12 d-flex justify-content-end">
            <ul role="list" class="text-white fs-3 my-5">
              <li className="pb-2">
                <strong>No Roadmap</strong>
              </li>
              <li className="pb-2">
                <strong>No Discord</strong>
              </li>
              <li className="pb-2">
                <strong>CC0 </strong>
              </li>
              <li className="pb-2">
                <strong>Instant Reveal</strong>
              </li>
              <li className="pb-2">
                <strong>7.5% Royalties</strong>
              </li>
              <li className="pb-2">
                <strong>5% (500 reserved for the team)</strong>
              </li>
              <li className="pb-2">
                <strong>
                  Story Driven, it's time to assemble your WolfPack
                </strong>
              </li>
            </ul>
          </div>
        </div>
        <div className="row">
          <div className="col-lg-6 col-md-12 d-flex justify-content-center ">
            <a href="#" className="link-light">
              Contract Created by MirImadAhmed
            </a>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="row my-5 pt-5 g-5">
          <div className="col-lg-6 col-md-12 d-flex flex-column justify-content-center text-white">
            <h1 class="display-3 fw-bold text-lg-start text-center">
              THE MOONRUNNERS ARE TAKING OVER
            </h1>
            <p class="fs-4 lh-lg my-4 text-lg-start text-center">
              A collection of 10,000 handcrafted PFPs. For the longest time,
              this Wolfpack lived in harmony and peace on Primordia among
              humankind, but one month would change the course of history
              forever and now the Crimson full moon is coming once again...
            </p>
          </div>
          <div className="col-lg-6 col-md-12 d-flex align-items-end">
            <img src={"config/images/nfts.png"} width="100%" alt="nft image" />
          </div>
        </div>

        <div className="row pt-5 g-5 text-white">
          <h1 class="display-3 fw-bold"> FAQs</h1>
        </div>

        <div className="row pt-5 g-5">
          <div className="col-lg-6 col-md-12 d-flex flex-column justify-content-center text-white">
            <p class="fs-3 my-4 fw-bold">
              <strong>Is there a Discord?</strong>
            </p>
            <p class="fs-5 fw-light lh-lg">
              No, we are a Twitter focused project. We wanted to cut out the
              noise and need to go to Discord to stay up to date.
            </p>

            <p class="fs-3 my-4 fw-bold">
              <strong>Is there a Discord?</strong>
            </p>
            <p class="fs-5 fw-light lh-lg">
              No, we are a Twitter focused project. We wanted to cut out the
              noise and need to go to Discord to stay up to date.
            </p>

            <p class="fs-3 my-4 fw-bold">
              <strong>Is there a Discord?</strong>
            </p>
            <p class="fs-5 fw-light lh-lg">
              No, we are a Twitter focused project. We wanted to cut out the
              noise and need to go to Discord to stay up to date.
            </p>
          </div>
          <div className="col-lg-6 col-md-12 d-flex flex-column justify-content-start text-white">
            <p class="fs-3 my-4 fw-bold">
              <strong>Is there a Discord?</strong>
            </p>
            <p class="fs-5 fw-light lh-lg">
              No, we are a Twitter focused project. We wanted to cut out the
              noise and need to go to Discord to stay up to date.
            </p>
            <p class="fs-3 my-4 fw-bold">
              <strong>Is there a Discord?</strong>
            </p>
            <p class="fs-5 fw-light lh-lg">
              No, we are a Twitter focused project. We wanted to cut out the
              noise and need to go to Discord to stay up to date.
            </p>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="row my-5 pt-5 g-5">
          <div className="col-lg-3 col-md-6">
            <a href="#" className="link-light">
              Link
            </a>
          </div>
          <div className="col-lg-3 col-md-6">
            <a href="#" className="link-light">
              Link
            </a>
          </div>{" "}
          <div className="col-lg-3 col-md-6">
            <a href="#" className="link-light">
              Link
            </a>
          </div>{" "}
          <div className="col-lg-3 col-md-6">
            <a href="#" className="link-light">
              Link
            </a>
          </div>
        </div>
      </div>

      <s.FlexContainer
        jc={"center"}
        ai={"center"}
        fd={"row"}
        style={{
          display: "none",
        }}
      >
        <s.Mint>
          <s.TextTitle
            size={3.0}
            style={{
              letterSpacing: "3px",
            }}
          >
            {statusAlert}
          </s.TextTitle>
          <s.SpacerSmall />
          <s.SpacerLarge />
          <s.FlexContainer fd={"row"} ai={"center"} jc={"space-between"}>
            <s.TextTitle>Available</s.TextTitle>
            <s.TextTitle color={"var(--primary)"}>
              {CONFIG.MAX_SUPPLY - supply} / {CONFIG.MAX_SUPPLY}
            </s.TextTitle>
          </s.FlexContainer>
          <s.SpacerSmall />
          <s.Line />

          <s.SpacerLarge />
          {blockchain.account !== "" &&
          blockchain.smartContract !== null &&
          blockchain.errorMsg === "" ? (
            <s.Container ai={"center"} jc={"center"} fd={"row"}>
              <s.connectButton
                disabled={disable}
                onClick={(e) => {
                  e.preventDefault();
                  claimNFTs();
                }}
              >
                {claimingNft ? "Confirm Transaction in Wallet" : "Mint"}
                {/* {mintDone && !claimingNft  ? feedback : ""} */}
              </s.connectButton>{" "}
            </s.Container>
          ) : (
            <>
              {/* {blockchain.errorMsg === "" ? ( */}
              <s.connectButton
                style={{
                  textAlign: "center",
                  color: "#d5c97d",
                  cursor: "pointer",
                }}
                disabled={state == 0 ? 1 : 0}
                onClick={(e) => {
                  e.preventDefault();
                  dispatch(connectWallet());
                  getData();
                }}
              >
                Connect Wallet
              </s.connectButton>
              {/* ) : ("")} */}
            </>
          )}
          <s.SpacerLarge />
          {blockchain.errorMsg !== "" ? (
            <s.connectButton
              style={{
                textAlign: "center",
                color: "#d5c97d",
                cursor: "pointer",
              }}
            >
              {blockchain.errorMsg}
            </s.connectButton>
          ) : (
            <s.TextDescription
              style={{
                textAlign: "center",
                color: "#d5c97d",
                cursor: "pointer",
              }}
            >
              {feedback}
            </s.TextDescription>
          )}
        </s.Mint>
      </s.FlexContainer>
    </>
  );
}

export default Home;
