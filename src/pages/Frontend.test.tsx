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
    });

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    // Check if the progress bar renders the correct text
    expect(screen.getByText((content, element) => element.textContent === '75 / 100 XLM')).toBeInTheDocument();
  });
});
