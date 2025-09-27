using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media.Animation;
using IWshRuntimeLibrary;
using File = System.IO.File;

namespace Installer
{
    public partial class MainWindow
    {
        private const string AppExeName = "xds-code.exe";
        private const string AppDisplayName = "XD's Code";
        private const string AppVersion = "0.5.0";
        private const string ShortcutName = AppDisplayName + ".lnk";

        private const string DownloadUrl =
            "https://raw.githubusercontent.com/XDPXI/XDs-Code/main/installer/releases/0.5.0.zip";

        private readonly string _desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        private readonly string _extractPath;

        private readonly string _localAppData =
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

        private readonly string _programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
        private bool _didUninstall;
        private bool _hasInstalled;

        private bool _isDownloading;

        public MainWindow()
        {
            InitializeComponent();
            TitleText.Text = $"{AppDisplayName} Setup";
            _extractPath = Path.Combine(_localAppData, AppDisplayName);
        }

        private static void CreateShortcut(string location, string targetPath, string shortcutName,
            string description = "")
        {
            try
            {
                var shortcutPath = Path.Combine(location, shortcutName);
                var shell = new WshShell();
                var shortcut = (IWshShortcut)shell.CreateShortcut(shortcutPath);
                shortcut.TargetPath = targetPath;
                shortcut.WorkingDirectory = Path.GetDirectoryName(targetPath);
                shortcut.IconLocation = targetPath;
                shortcut.Description = description;
                shortcut.Save();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to create shortcut: {ex.Message}", "Installer", MessageBoxButton.OK,
                    MessageBoxImage.Warning);
            }
        }

        private async Task InstallAsync()
        {
            try
            {
                _isDownloading = true;
                InstallButton.Visibility = Visibility.Collapsed;
                UninstallButton.Visibility = Visibility.Collapsed;
                NextButton.Visibility = Visibility.Collapsed;
                NextButtonDisabled.Visibility = Visibility.Visible;
                CancelButton2.Visibility = Visibility.Collapsed;

                ProgressBar.IsIndeterminate = true;
                SetStatus("Downloading & Extracting files...");
                await ExtractFilesWithProgress();

                SetStatus("Creating shortcuts...");
                var appPath = Path.Combine(_extractPath, AppExeName);
                CreateShortcut(_desktop, appPath, ShortcutName, "Launch XD's Code");
                CreateShortcut(_programs, appPath, ShortcutName);

                SetStatus("Cleaning up...");
                var zipFilePath = Path.Combine(_extractPath, $"install-{AppDisplayName}-{AppVersion}.zip");
                if (File.Exists(zipFilePath)) File.Delete(zipFilePath);

                SetStatus("Installation completed!");
                ProgressBar.IsIndeterminate = false;

                _isDownloading = false;
                _hasInstalled = true;

                CancelButton.Visibility = Visibility.Collapsed;
                NextButtonDisabled.Visibility = Visibility.Collapsed;
                DoneButton.Visibility = Visibility.Visible;

                SmoothProgressBarUpdate(100);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Installation failed:\n{ex.Message}", "Installer", MessageBoxButton.OK,
                    MessageBoxImage.Error);
                Log($"Install error: {ex}");
            }
        }

        private async Task UninstallAsync()
        {
            try
            {
                var result = MessageBox.Show("Do you want to Uninstall?", "Installer", MessageBoxButton.YesNo,
                    MessageBoxImage.Warning);
                if (result == MessageBoxResult.Yes)
                    try
                    {
                        _isDownloading = true;
                        InstallButton.Visibility = Visibility.Collapsed;
                        UninstallButton.Visibility = Visibility.Collapsed;
                        NextButton.Visibility = Visibility.Collapsed;
                        NextButtonDisabled.Visibility = Visibility.Visible;
                        CancelButton2.Visibility = Visibility.Collapsed;

                        ProgressBar.IsIndeterminate = true;
                        SetStatus("Removing files...");
                        foreach (var file in Directory.GetFiles(_extractPath))
                            await TryDelete(() => Task.Run(() => File.Delete(file)));

                        SetStatus("Removing folders...");
                        foreach (var dir in Directory.GetDirectories(_extractPath))
                            await TryDelete(() => Task.Run(() => Directory.Delete(dir, true)));

                        SetStatus("Removing shortcuts...");
                        await TryDelete(() => Task.Run(() => File.Delete(Path.Combine(_desktop, ShortcutName))));
                        await TryDelete(() => Task.Run(() => File.Delete(Path.Combine(_programs, ShortcutName))));

                        SetStatus("Uninstallation completed!");
                        ProgressBar.IsIndeterminate = false;

                        _isDownloading = false;
                        _hasInstalled = true;
                        _didUninstall = true;

                        CancelButton.Visibility = Visibility.Collapsed;
                        NextButtonDisabled.Visibility = Visibility.Collapsed;
                        DoneButton.Visibility = Visibility.Visible;

                        SmoothProgressBarUpdate(100);
                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show($"Installation failed:\n{ex.Message}", "Installer", MessageBoxButton.OK,
                            MessageBoxImage.Error);
                        Log($"Install error: {ex}");
                    }
            }
            catch (Exception ex)
            {
                Log($"Uninstall error: {ex}");
            }
        }

        private async Task TryDelete(Func<Task> deleteAction)
        {
            try
            {
                await deleteAction();
            }
            catch (Exception ex)
            {
                Log($"Failed to delete file: {ex}");
            }
        }

        private async void Manager(int type)
        {
            if (_isDownloading || _hasInstalled)
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

        private async Task ExtractFilesWithProgress()
        {
            var zipPath = Path.Combine(_extractPath, $"install-{AppDisplayName}-{AppVersion}.zip");

            try
            {
                if (!Directory.Exists(_extractPath))
                    Directory.CreateDirectory(_extractPath);

                await DownloadFileAsync(DownloadUrl, zipPath);

                if (!File.Exists(zipPath))
                    throw new IOException("Zip file not found after download.");

                foreach (var file in Directory.GetFiles(_extractPath))
                    if (!file.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                        File.Delete(file);

                if (Directory.Exists(_extractPath))
                    foreach (var file in Directory.GetFiles(_extractPath))
                        if (!file.Equals(zipPath, StringComparison.OrdinalIgnoreCase))
                            try
                            {
                                File.Delete(file);
                            }
                            catch (Exception ex)
                            {
                                Log($"Failed to delete file during extraction: {ex.Message}");
                            }

                ZipFile.ExtractToDirectory(zipPath, _extractPath);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Extraction failed:\n{ex.Message}", "Installer Error", MessageBoxButton.OK,
                    MessageBoxImage.Error);
                Log($"Extraction error: {ex}");
            }
            finally
            {
                if (File.Exists(zipPath)) File.Delete(zipPath);
            }
        }

        private async Task DownloadFileAsync(string url, string destinationPath)
        {
            try
            {
                using (var client = new HttpClient())
                {
                    using (var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead))
                    {
                        response.EnsureSuccessStatusCode();

                        var totalBytes = response.Content.Headers.ContentLength ?? -1;
                        long downloadedBytes = 0;

                        using (var contentStream = await response.Content.ReadAsStreamAsync())
                        using (var fileStream = new FileStream(destinationPath, FileMode.Create, FileAccess.Write))
                        {
                            var buffer = new byte[8192];
                            int bytesRead;
                            while ((bytesRead = await contentStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                            {
                                await fileStream.WriteAsync(buffer, 0, bytesRead);
                                downloadedBytes += bytesRead;

                                if (totalBytes > 0)
                                {
                                    var progress = (double)downloadedBytes / totalBytes * 100;
                                    Dispatcher.Invoke(() => SmoothProgressBarUpdate(progress));
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Download failed:\n{ex.Message}", "Installer", MessageBoxButton.OK,
                    MessageBoxImage.Error);
                Log($"Download error: {ex}");
            }
        }

        private void SetStatus(string text)
        {
            StatusLabel.Text = text;
            AnimateStatusLabel(StatusLabel, text, 0, 1);
        }

        private void AnimateStatusLabel(TextBlock label, string text, double from, double to)
        {
            label.BeginAnimation(OpacityProperty, new DoubleAnimation
            {
                From = from,
                To = to,
                Duration = TimeSpan.FromSeconds(1)
            });
            label.Text = text;
        }

        private void SmoothProgressBarUpdate(double value)
        {
            ProgressBar.BeginAnimation(RangeBase.ValueProperty, new DoubleAnimation
            {
                From = ProgressBar.Value,
                To = value,
                Duration = TimeSpan.FromSeconds(0.5),
                EasingFunction = new QuadraticEase()
            });
        }

        private void Grid_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            DragMove();
        }

        private void DoneButton_Click(object sender, RoutedEventArgs e)
        {
            if (!_didUninstall)
                try
                {
                    var shortcutPath = Path.Combine(_desktop, ShortcutName);
                    if (File.Exists(shortcutPath))
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = shortcutPath,
                            UseShellExecute = true
                        });
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Failed to launch app:\n{ex.Message}", "Launcher", MessageBoxButton.OK,
                        MessageBoxImage.Warning);
                    Log($"Launch error: {ex}");
                }

            Close();
        }

        protected override void OnClosing(CancelEventArgs e)
        {
            if (!_hasInstalled)
            {
                var result = MessageBox.Show("Cancel installation?", "Installer", MessageBoxButton.YesNo,
                    MessageBoxImage.Warning);
                if (result != MessageBoxResult.Yes)
                {
                    e.Cancel = true;
                    return;
                }
            }

            base.OnClosing(e);
        }

        private void Log(string message)
        {
            try
            {
                var logPath = Path.Combine(_extractPath, "log.txt");
                File.AppendAllText(logPath, string.Format("[{0}] {1}{2}", DateTime.Now, message, Environment.NewLine));
            }
            catch (Exception)
            {
                /* */
            }
        }
    }
}