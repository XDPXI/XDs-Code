using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media.Animation;
using IWshRuntimeLibrary;
using Microsoft.Win32;
using File = System.IO.File;

namespace Installer
{
    public partial class MainWindow
    {
        public MainWindow()
        {
            InitializeComponent();
            TitleText.Text = $"{AppDisplayName} Setup";
            _extractPath = Path.Combine(_localAppData, AppDisplayName);
            _cancellationTokenSource = new CancellationTokenSource();

            CheckInstallationStatus();
        }

        #region Logging

        private void Log(string message)
        {
            Task.Run(() =>
            {
                try
                {
                    var logDir = Path.Combine(_localAppData, AppDisplayName);
                    if (!Directory.Exists(logDir))
                        Directory.CreateDirectory(logDir);

                    var logPath = Path.Combine(logDir, "installer.log");
                    var logMessage = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}";

                    File.AppendAllText(logPath, logMessage);
                }
                catch (Exception)
                {
                }
            });
        }

        #endregion

        #region Constants

        private const string AppExeName = "xds-code.exe";
        private const string AppDisplayName = "XD's Code";
        private const string AppVersion = "0.5.0";
        private const string ShortcutName = AppDisplayName + ".lnk";

        private const string RegistryUninstallKey =
            @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\" + AppDisplayName;

        private const string DownloadUrl =
            "https://raw.githubusercontent.com/XDPXI/XDs-Code/main/installer/releases/0.5.0.zip";

        #endregion

        #region Fields

        private readonly string _desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        private readonly string _extractPath;

        private readonly string _localAppData =
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

        private readonly string _programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
        private readonly string _startMenu = Environment.GetFolderPath(Environment.SpecialFolder.StartMenu);

        private bool _didUninstall;
        private bool _hasInstalled;
        private bool _isOperationInProgress;
        private readonly CancellationTokenSource _cancellationTokenSource;

        #endregion

        #region Installation Status

        private void CheckInstallationStatus()
        {
            try
            {
                var appPath = Path.Combine(_extractPath, AppExeName);
                var isInstalled = File.Exists(appPath) && IsRegisteredInRegistry();

                if (isInstalled)
                {
                    SetStatus("Application is already installed.");
                    InstallButton.Content = "Reinstall";
                    UninstallButton.Visibility = Visibility.Visible;
                }
                else
                {
                    SetStatus("Ready to install.");
                    InstallButton.Content = "Install";
                    UninstallButton.Visibility = Visibility.Collapsed;
                }
            }
            catch (Exception ex)
            {
                Log($"Error checking installation status: {ex.Message}");
            }
        }

        private bool IsRegisteredInRegistry()
        {
            try
            {
                using (var key = Registry.CurrentUser.OpenSubKey(RegistryUninstallKey))
                {
                    return key != null;
                }
            }
            catch
            {
                return false;
            }
        }

        #endregion

        #region Registry Management

        private void RegisterInRegistry()
        {
            try
            {
                var appPath = Path.Combine(_extractPath, AppExeName);
                var uninstallPath = Process.GetCurrentProcess().MainModule?.FileName ?? "";

                using (var key = Registry.CurrentUser.CreateSubKey(RegistryUninstallKey))
                {
                    if (key == null)
                    {
                        Log("Failed to create or open registry key for uninstallation.");
                        return;
                    }
                    
                    key.SetValue("DisplayName", AppDisplayName);
                    key.SetValue("DisplayVersion", AppVersion);
                    key.SetValue("Publisher", "XD");
                    key.SetValue("InstallLocation", _extractPath);
                    key.SetValue("UninstallString", $"\"{uninstallPath}\" /uninstall");
                    key.SetValue("DisplayIcon", appPath);
                    key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                    key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                    key.SetValue("InstallDate", DateTime.Now.ToString("yyyyMMdd"));

                    var size = CalculateDirectorySize(_extractPath);
                    key.SetValue("EstimatedSize", size / 1024, RegistryValueKind.DWord);
                }
            }
            catch (Exception ex)
            {
                Log($"Failed to register in registry: {ex.Message}");
            }
        }

        private void UnregisterFromRegistry()
        {
            try
            {
                Registry.CurrentUser.DeleteSubKey(RegistryUninstallKey, false);
            }
            catch (Exception ex)
            {
                Log($"Failed to unregister from registry: {ex.Message}");
            }
        }

        private long CalculateDirectorySize(string directory)
        {
            try
            {
                if (!Directory.Exists(directory))
                    return 0;

                long size = 0;
                foreach (var file in Directory.GetFiles(directory, "*", SearchOption.AllDirectories))
                    size += new FileInfo(file).Length;
                return size;
            }
            catch
            {
                return 0;
            }
        }

        #endregion

        #region Shortcut Management

        private void CreateShortcut(string location, string targetPath, string shortcutName, string description = "")
        {
            try
            {
                if (!Directory.Exists(location))
                    Directory.CreateDirectory(location);

                var shortcutPath = Path.Combine(location, shortcutName);
                var shell = new WshShell();
                var shortcut = (IWshShortcut)shell.CreateShortcut(shortcutPath);
                shortcut.TargetPath = targetPath;
                shortcut.WorkingDirectory = Path.GetDirectoryName(targetPath);
                shortcut.IconLocation = targetPath;
                shortcut.Description = description;
                shortcut.Save();

                Log($"Created shortcut: {shortcutPath}");
            }
            catch (Exception ex)
            {
                var message = $"Failed to create shortcut at {location}: {ex.Message}";
                Log(message);
            }
        }

        private void RemoveShortcuts()
        {
            var shortcutPaths = new[]
            {
                Path.Combine(_desktop, ShortcutName),
                Path.Combine(_programs, ShortcutName),
                Path.Combine(_startMenu, "Programs", ShortcutName)
            };

            foreach (var path in shortcutPaths)
                try
                {
                    if (File.Exists(path))
                    {
                        File.Delete(path);
                        Log($"Removed shortcut: {path}");
                    }
                }
                catch (Exception ex)
                {
                    Log($"Failed to remove shortcut {path}: {ex.Message}");
                }
        }

        #endregion

        #region Installation

        private async Task InstallAsync()
        {
            try
            {
                SetOperationInProgress(true);
                SetStatus("Preparing installation...");

                if (!Directory.Exists(_extractPath))
                    Directory.CreateDirectory(_extractPath);

                SetStatus("Downloading application...");
                await ExtractFilesWithProgress(_cancellationTokenSource.Token);

                if (_cancellationTokenSource.Token.IsCancellationRequested)
                {
                    SetStatus("Installation cancelled.");
                    return;
                }

                // Verify installation
                var appPath = Path.Combine(_extractPath, AppExeName);
                if (!File.Exists(appPath))
                    throw new FileNotFoundException($"Application executable not found: {AppExeName}");

                SetStatus("Creating shortcuts...");
                CreateShortcut(_desktop, appPath, ShortcutName, $"Launch {AppDisplayName}");
                CreateShortcut(_programs, appPath, ShortcutName, $"Launch {AppDisplayName}");
                CreateShortcut(Path.Combine(_startMenu, "Programs"), appPath, ShortcutName, $"Launch {AppDisplayName}");

                SetStatus("Registering application...");
                RegisterInRegistry();

                SetStatus("Installation completed successfully!");
                CompleteOperation(false);

                Log("Installation completed successfully");
            }
            catch (OperationCanceledException)
            {
                SetStatus("Installation cancelled.");
                Log("Installation was cancelled by user");
            }
            catch (Exception ex)
            {
                var message = $"Installation failed: {ex.Message}";
                SetStatus("Installation failed.");
                MessageBox.Show(message, "Installation Error", MessageBoxButton.OK, MessageBoxImage.Error);
                Log($"Installation error: {ex}");
                SetOperationInProgress(false);
            }
        }

        private async Task UninstallAsync()
        {
            try
            {
                var result = MessageBox.Show(
                    $"Are you sure you want to uninstall {AppDisplayName}?\n\nThis will remove all application files and shortcuts.",
                    "Confirm Uninstall",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Question);

                if (result != MessageBoxResult.Yes)
                    return;

                SetOperationInProgress(true);
                SetStatus("Preparing uninstallation...");

                await CloseRunningInstances();

                SetStatus("Removing shortcuts...");
                RemoveShortcuts();

                SetStatus("Removing application files...");
                await RemoveApplicationFiles();

                SetStatus("Unregistering application...");
                UnregisterFromRegistry();

                SetStatus("Uninstallation completed successfully!");
                _didUninstall = true;
                CompleteOperation(true);

                Log("Uninstallation completed successfully");
            }
            catch (Exception ex)
            {
                var message = $"Uninstallation failed: {ex.Message}";
                SetStatus("Uninstallation failed.");
                MessageBox.Show(message, "Uninstallation Error", MessageBoxButton.OK, MessageBoxImage.Error);
                Log($"Uninstallation error: {ex}");
                SetOperationInProgress(false);
            }
        }

        private async Task CloseRunningInstances()
        {
            try
            {
                var processes = Process.GetProcessesByName(Path.GetFileNameWithoutExtension(AppExeName));
                foreach (var process in processes)
                    try
                    {
                        if (!process.HasExited)
                        {
                            process.CloseMainWindow();
                            if (!process.WaitForExit(5000)) // Wait 5 seconds
                                process.Kill();
                        }
                    }
                    catch (Exception ex)
                    {
                        Log($"Failed to close process {process.ProcessName}: {ex.Message}");
                    }
                    finally
                    {
                        process?.Dispose();
                    }

                await Task.Delay(1000);
            }
            catch (Exception ex)
            {
                Log($"Error closing running instances: {ex.Message}");
            }
        }

        private async Task RemoveApplicationFiles()
        {
            if (!Directory.Exists(_extractPath))
                return;

            await RetryOperation(async () =>
            {
                foreach (var file in Directory.GetFiles(_extractPath, "*", SearchOption.AllDirectories))
                    await TryDeleteFile(file);

                foreach (var dir in Directory.GetDirectories(_extractPath)) await TryDeleteDirectory(dir);

                if (Directory.Exists(_extractPath)) Directory.Delete(_extractPath, true);
            }, 3, 1000);
        }

        private async Task RetryOperation(Func<Task> operation, int maxRetries = 3, int delayMs = 1000)
        {
            for (var i = 0; i <= maxRetries; i++)
                try
                {
                    await operation();
                    return;
                }
                catch (Exception ex)
                {
                    if (i == maxRetries)
                        throw;

                    Log($"Operation failed (attempt {i + 1}/{maxRetries + 1}): {ex.Message}");
                    await Task.Delay(delayMs);
                }
        }

        private async Task TryDeleteFile(string filePath)
        {
            try
            {
                if (File.Exists(filePath))
                {
                    File.SetAttributes(filePath, FileAttributes.Normal);
                    File.Delete(filePath);
                }
            }
            catch (Exception ex)
            {
                Log($"Failed to delete file {filePath}: {ex.Message}");
                await Task.Delay(100);
            }
        }

        private async Task TryDeleteDirectory(string directoryPath)
        {
            try
            {
                if (Directory.Exists(directoryPath)) Directory.Delete(directoryPath, true);
            }
            catch (Exception ex)
            {
                Log($"Failed to delete directory {directoryPath}: {ex.Message}");
                await Task.Delay(100);
            }
        }

        #endregion

        #region Download and Extract

        private async Task ExtractFilesWithProgress(CancellationToken cancellationToken)
        {
            var zipPath = Path.Combine(_extractPath, $"install-{AppDisplayName}-{AppVersion}.zip");

            try
            {
                await DownloadFileAsync(DownloadUrl, zipPath, cancellationToken);

                if (cancellationToken.IsCancellationRequested)
                    return;

                if (!File.Exists(zipPath))
                    throw new IOException("Downloaded file not found.");

                SetStatus("Validating download...");
                if (new FileInfo(zipPath).Length == 0)
                    throw new IOException("Downloaded file is empty.");

                SetStatus("Preparing extraction...");
                CleanExistingFiles(zipPath);

                SetStatus("Extracting files...");
                ZipFile.ExtractToDirectory(zipPath, _extractPath);

                Log($"Successfully extracted files to: {_extractPath}");
            }
            catch (Exception ex)
            {
                Log($"Extraction error: {ex}");
                throw;
            }
            finally
            {
                try
                {
                    if (File.Exists(zipPath))
                        File.Delete(zipPath);
                }
                catch (Exception ex)
                {
                    Log($"Failed to delete zip file: {ex.Message}");
                }
            }
        }

        private void CleanExistingFiles(string excludeFile)
        {
            try
            {
                foreach (var file in Directory.GetFiles(_extractPath))
                    if (!file.Equals(excludeFile, StringComparison.OrdinalIgnoreCase))
                        try
                        {
                            File.Delete(file);
                        }
                        catch (Exception ex)
                        {
                            Log($"Failed to delete existing file {file}: {ex.Message}");
                        }

                foreach (var directory in Directory.GetDirectories(_extractPath))
                    try
                    {
                        Directory.Delete(directory, true);
                    }
                    catch (Exception ex)
                    {
                        Log($"Failed to delete existing directory {directory}: {ex.Message}");
                    }
            }
            catch (Exception ex)
            {
                Log($"Error cleaning existing files: {ex.Message}");
            }
        }

        private async Task DownloadFileAsync(string url, string destinationPath, CancellationToken cancellationToken)
        {
            try
            {
                using (var client = new HttpClient())
                {
                    client.Timeout = TimeSpan.FromMinutes(10); // 10 minute timeout

                    using (var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead,
                               cancellationToken))
                    {
                        response.EnsureSuccessStatusCode();

                        var totalBytes = response.Content.Headers.ContentLength ?? -1;
                        long downloadedBytes = 0;

                        using (var contentStream = await response.Content.ReadAsStreamAsync())
                        using (var fileStream = new FileStream(destinationPath, FileMode.Create, FileAccess.Write))
                        {
                            var buffer = new byte[8192];
                            int bytesRead;

                            while ((bytesRead =
                                       await contentStream.ReadAsync(buffer, 0, buffer.Length, cancellationToken)) > 0)
                            {
                                await fileStream.WriteAsync(buffer, 0, bytesRead, cancellationToken);
                                downloadedBytes += bytesRead;

                                if (totalBytes > 0)
                                {
                                    var progress = (double)downloadedBytes / totalBytes * 100;
                                    Dispatcher.Invoke(() => SmoothProgressBarUpdate(progress));
                                }

                                cancellationToken.ThrowIfCancellationRequested();
                            }
                        }
                    }
                }

                Log($"Successfully downloaded: {destinationPath} ({new FileInfo(destinationPath).Length} bytes)");
            }
            catch (OperationCanceledException)
            {
                try
                {
                    if (File.Exists(destinationPath))
                        File.Delete(destinationPath);
                }
                catch
                {
                }

                throw;
            }
            catch (Exception ex)
            {
                Log($"Download error: {ex}");
                throw;
            }
        }

        #endregion

        #region UI Management

        private void SetOperationInProgress(bool inProgress)
        {
            _isOperationInProgress = inProgress;

            if (inProgress)
            {
                InstallButton.Visibility = Visibility.Collapsed;
                UninstallButton.Visibility = Visibility.Collapsed;
                NextButton.Visibility = Visibility.Collapsed;
                NextButtonDisabled.Visibility = Visibility.Visible;
                CancelButton2.Visibility = Visibility.Visible;
                CancelButton.Visibility = Visibility.Collapsed;

                ProgressBar.IsIndeterminate = true;
                ProgressBar.Value = 0;
            }
        }

        private void CompleteOperation(bool wasUninstall)
        {
            _isOperationInProgress = false;
            _hasInstalled = true;

            ProgressBar.IsIndeterminate = false;
            SmoothProgressBarUpdate(100);

            CancelButton.Visibility = Visibility.Collapsed;
            CancelButton2.Visibility = Visibility.Collapsed;
            NextButtonDisabled.Visibility = Visibility.Collapsed;
            DoneButton.Visibility = Visibility.Visible;

            if (!wasUninstall)
                DoneButton.Content = "Launch Application";
            else
                DoneButton.Content = "Close";
        }

        private void SetStatus(string text)
        {
            Dispatcher.Invoke(() =>
            {
                StatusLabel.Text = text;
                AnimateStatusLabel(StatusLabel, text, 0.7, 1.0);
            });
        }

        private void AnimateStatusLabel(TextBlock label, string text, double from, double to)
        {
            var animation = new DoubleAnimation
            {
                From = from,
                To = to,
                Duration = TimeSpan.FromSeconds(0.5),
                EasingFunction = new QuadraticEase()
            };

            label.BeginAnimation(OpacityProperty, animation);
        }

        private void SmoothProgressBarUpdate(double value)
        {
            var animation = new DoubleAnimation
            {
                From = ProgressBar.Value,
                To = Math.Max(0, Math.Min(100, value)),
                Duration = TimeSpan.FromSeconds(0.3),
                EasingFunction = new QuadraticEase()
            };

            ProgressBar.BeginAnimation(RangeBase.ValueProperty, animation);
        }

        #endregion

        #region Event Handlers

        private async void Manager(int type)
        {
            if (_isOperationInProgress)
                return;

            if (type == 1)
                await InstallAsync();
            else if (type == 2)
                await UninstallAsync();
        }

        private void NextButton_Click(object sender, RoutedEventArgs e)
        {
            Manager(1);
        }

        private void CancelButton_Click(object sender, RoutedEventArgs e)
        {
            Close();
        }

        private void UninstallButton_Click(object sender, RoutedEventArgs e)
        {
            Manager(2);
        }

        private void Grid_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            try
            {
                DragMove();
            }
            catch (Exception ex)
            {
                Log($"Error in DragMove: {ex.Message}");
            }
        }

        private void DoneButton_Click(object sender, RoutedEventArgs e)
        {
            if (!_didUninstall && !_isOperationInProgress)
                try
                {
                    var appPath = Path.Combine(_extractPath, AppExeName);
                    if (File.Exists(appPath))
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = appPath,
                            UseShellExecute = true,
                            WorkingDirectory = appPath
                        });
                    else
                        MessageBox.Show(
                            "Application executable not found. Please reinstall the application.",
                            "Launch Error",
                            MessageBoxButton.OK,
                            MessageBoxImage.Warning);
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Failed to launch application:\n{ex.Message}", "Launch Error", MessageBoxButton.OK,
                        MessageBoxImage.Warning);
                    Log($"Launch error: {ex}");
                }

            Close();
        }

        protected override void OnClosing(CancelEventArgs e)
        {
            if (_isOperationInProgress)
            {
                var result = MessageBox.Show(
                    "An operation is currently in progress. Are you sure you want to exit?",
                    "Operation In Progress",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Warning);

                if (result != MessageBoxResult.Yes)
                {
                    e.Cancel = true;
                    return;
                }

                _cancellationTokenSource.Cancel();
            }
            else if (!_hasInstalled)
            {
                var result = MessageBox.Show(
                    "Exit installer?",
                    "Exit Installer",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Question);

                if (result != MessageBoxResult.Yes)
                {
                    e.Cancel = true;
                    return;
                }
            }

            _cancellationTokenSource?.Dispose();
            base.OnClosing(e);
        }

        #endregion
    }
}