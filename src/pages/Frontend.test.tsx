import { describe, test, expect, afterEach, vi } from "vitest";
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { LandingPage } from './LandingPage';
import { DashboardPage } from './DashboardPage';
import * as UseStellarModule from '../hooks/useStellar';

global.IntersectionObserver = class IntersectionObserver {
  observe() { return null; }
  disconnect() { return null; }
  unobserve() { return null; }
};

// Mock the context hook completely to avoid loading its problematic dependencies in tests
vi.mock("../components/Toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock('../hooks/useStellar', () => ({
  useStellar: vi.fn(),
}));

vi.mock('../context/StellarContext', () => ({
  StellarProvider: ({ children }: any) => <div>{children}</div>,
  CONTRACT_ID: 'MOCK_CONTRACT_ID',
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  server: {
    loadAccount: vi.fn(),
  },
  rpcServer: {},
}));

describe('Frontend Tests', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('wallet-not-found error renders the correct message on LandingPage', () => {
    (UseStellarModule.useStellar as vi.Mock).mockReturnValue({
      pubKey: '',
      appError: 'Wallet not found. Please install Freighter.',
      connectWallet: vi.fn(),
      customCampaigns: [],
      globalCampaigns: [],
      activeContractId: 'MOCK_CONTRACT_ID',
    });

    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Wallet not found. Please install Freighter.')).toBeInTheDocument();
  });

  test('donation form rejects a submission with insufficient balance on DashboardPage', async () => {
    (UseStellarModule.useStellar as vi.Mock).mockReturnValue({
      pubKey: 'GABC123...',
      balance: '10', // User has 10 XLM
      campaign: {
        creator: 'GXYZ',
        deadline: Date.now() / 1000 + 3600,
        goal: 100,
        status: 'active',
        token: 'XLM',
        totalRaised: 50,
      },
      recentDonations: [],
      fetchBalance: vi.fn(),
      fetchCampaignState: vi.fn(),
      customCampaigns: [],
      globalCampaigns: [],
      activeContractId: 'MOCK_CONTRACT_ID',
    });

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    const input = screen.getByPlaceholderText('10');
    fireEvent.change(input, { target: { value: '20' } }); // Trying to donate 20 XLM

    const submitButton = screen.getByText('Donate Now');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Insufficient XLM balance for this transaction.')).toBeInTheDocument();
    });
  });

  test('progress bar renders correct percentage given mock contract state', () => {
    (UseStellarModule.useStellar as vi.Mock).mockReturnValue({
      pubKey: 'GABC123...',
      balance: '100',
      campaign: {
        creator: 'GXYZ',
        deadline: Date.now() / 1000 + 3600,
        goal: 100,
        status: 'active',
        token: 'XLM',
        totalRaised: 75,
      },
      recentDonations: [],
      fetchBalance: vi.fn(),
      fetchCampaignState: vi.fn(),
      customCampaigns: [],
      globalCampaigns: [],
      activeContractId: 'MOCK_CONTRACT_ID',
    });

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    // Check if the progress bar renders the correct text
    expect(screen.getByText((content, element) => element.textContent === '75 / 100 XLM')).toBeInTheDocument();
  });

  test('ContractInfoPanel renders and expands with contract verification details', () => {
    (UseStellarModule.useStellar as vi.Mock).mockReturnValue({
      pubKey: '',
      appError: '',
      connectWallet: vi.fn(),
      customCampaigns: [],
      globalCampaigns: [],
      activeContractId: 'MOCK_CONTRACT_ID',
    });

    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    const toggleButton = screen.getByRole('button', { name: /Toggle contract transparency panel/i });
    expect(toggleButton).toBeInTheDocument();

    // Expand the panel
    fireEvent.click(toggleButton);

    expect(screen.getByText('Deployed Contracts')).toBeInTheDocument();
    expect(screen.getByText(/active campaigns found on the network/i)).toBeInTheDocument();
  });

  test('donation form rejects zero or negative amounts with inline validation', async () => {
    (UseStellarModule.useStellar as vi.Mock).mockReturnValue({
      pubKey: 'GABC123...',
      balance: '100',
      campaign: {
        creator: 'GXYZ',
        deadline: Date.now() / 1000 + 3600,
        goal: 100,
        status: 'active',
        token: 'XLM',
        totalRaised: 50,
      },
      recentDonations: [],
      fetchBalance: vi.fn(),
      fetchCampaignState: vi.fn(),
      addDonationEvent: vi.fn(),
      customCampaigns: [],
      globalCampaigns: [],
      activeContractId: 'MOCK_CONTRACT_ID',
    });

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    const input = screen.getByPlaceholderText('10');
    fireEvent.change(input, { target: { value: '0' } });

    await waitFor(() => {
      expect(screen.getByText('Amount must be greater than 0.')).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /Donate Now/i });
    expect(submitButton).toBeDisabled();
  });

  test('activity feed and my transactions render donations and subtitles correctly', () => {
    const mockDonations = [
      {
        id: 'tx123456789012',
        donor: 'GABC1234567890',
        amount: 25,
        timestamp: new Date().toISOString(),
      },
      {
        id: 'tx987654321098',
        donor: 'GOTHERDONOR999',
        amount: 100,
        timestamp: new Date().toISOString(),
      }
    ];

    (UseStellarModule.useStellar as vi.Mock).mockReturnValue({
      pubKey: 'GABC1234567890',
      balance: '100',
      campaign: {
        creator: 'GXYZ',
        deadline: Date.now() / 1000 + 3600,
        goal: 1000,
        status: 'active',
        token: 'XLM',
        totalRaised: 125,
      },
      recentDonations: mockDonations,
      fetchBalance: vi.fn(),
      fetchCampaignState: vi.fn(),
      addDonationEvent: vi.fn(),
      customCampaigns: [],
      globalCampaigns: [],
      activeContractId: 'MOCK_CONTRACT_ID',
    });

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    // Verify distinct subtitles
    expect(screen.getByText('Live stream of all public contributions across Stellar')).toBeInTheDocument();
    expect(screen.getByText('Contributions sent from your connected wallet')).toBeInTheDocument();

    // Verify public Activity Feed contains both
    expect(screen.getAllByText('25 XLM').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('100 XLM').length).toBeGreaterThanOrEqual(1);

    // Verify My Transactions sidebar renders the connected user's transaction ID
    expect(screen.getByText('Tx ID: tx1234567890...')).toBeInTheDocument();

    // Verify quick preset buttons
    const preset50Btn = screen.getByRole('button', { name: /50 XLM/i });
    fireEvent.click(preset50Btn);
    const input = screen.getByPlaceholderText('10') as HTMLInputElement;
    expect(input.value).toBe('50');
  });
});



