import WalletManagerService from '../../services/wallet-manager.service';
import TonBlockchainService from '../../services/ton-blockchain.service';
import EncryptionUtil from '../../utils/encryption.util';

describe('WalletManagerService', () => {
  const baseDeps = () => {
    const mockDb = {
      oneOrNone: jest.fn(),
      one: jest.fn(),
    } as any;

    const mockTonService: jest.Mocked<Partial<TonBlockchainService>> = {
      initializeWallet: jest.fn().mockResolvedValue({
        address: 'EQCwalletaddress',
        publicKey: 'public-key',
      }),
      generatePaymentLink: jest.fn().mockReturnValue('ton://transfer/EQCwalletaddress?amount=12300000000'),
    };

    const mockEncryption: Partial<EncryptionUtil> = {
      encrypt: jest.fn().mockReturnValue('encrypted-mnemonic'),
    };

    return { mockDb, mockTonService, mockEncryption };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.TON_MIN_CONFIRMATIONS;
  });

  it('creates a deposit record and returns deposit details', async () => {
    const { mockDb, mockTonService, mockEncryption } = baseDeps();
    mockDb.oneOrNone.mockResolvedValueOnce(null);
    mockDb.one
      .mockResolvedValueOnce({ id: 'wallet-1' })
      .mockResolvedValueOnce({ id: 'deposit-1' });

    const service = new WalletManagerService({
      db: mockDb,
      tonService: mockTonService as unknown as TonBlockchainService,
      encryption: mockEncryption as EncryptionUtil,
      mnemonic: 'word '.repeat(24).trim(),
    });

    process.env.TON_MIN_CONFIRMATIONS = '2';

    const result = await service.createDepositAddress('user-1', 'payment-1', 12.34);

    expect(mockTonService.initializeWallet).toHaveBeenCalledTimes(1);
    expect(mockDb.one).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      depositId: 'deposit-1',
      address: 'EQCwalletaddress',
      expectedAmount: 12.34,
      expiresAt: expect.any(Date),
      paymentLink: 'ton://transfer/EQCwalletaddress?amount=12300000000',
      minConfirmations: 2,
    });
  });

  it('reuses initialized wallet on subsequent deposit creation', async () => {
    const { mockDb, mockTonService, mockEncryption } = baseDeps();
    mockDb.oneOrNone.mockResolvedValue({ id: 'wallet-existing' });
    mockDb.one.mockResolvedValue({ id: 'deposit-1' });

    const service = new WalletManagerService({
      db: mockDb,
      tonService: mockTonService as unknown as TonBlockchainService,
      encryption: mockEncryption as EncryptionUtil,
      mnemonic: 'word '.repeat(24).trim(),
    });

    await service.createDepositAddress('user-1', 'payment-1', 1);
    await service.createDepositAddress('user-1', 'payment-2', 2);

    expect(mockTonService.initializeWallet).toHaveBeenCalledTimes(1);
    expect(mockDb.one).toHaveBeenCalledTimes(2); // only deposit inserts
  });
});
