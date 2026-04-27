using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Text;
using System.IO;
using System.Text;
using System.Windows.Forms;

namespace OverrideLauncherNetFx
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new LauncherForm());
        }
    }

    internal sealed class LauncherForm : Form
    {
        private readonly Label _projectPathValueLabel;
        private readonly Label _serverStatusValueLabel;
        private readonly Label _pidValueLabel;
        private readonly Label _nodeStatusValueLabel;
        private readonly Label _npmStatusValueLabel;
        private readonly Label _depsStatusValueLabel;

        private readonly Button _startButton;
        private readonly Button _openBrowserButton;
        private readonly Button _stopButton;
        private readonly Button _openFolderButton;
        private readonly Button _checkEnvButton;
        private readonly Button _installNodeButton;
        private readonly Button _installDepsButton;

        private readonly Timer _statusTimer;
        private readonly string _projectRoot;
        private readonly string _startScript;
        private readonly string _stopScript;
        private readonly string _pidFile;
        private readonly string _fontPath;
        private readonly string _iconPath;

        private readonly PrivateFontCollection _fontCollection;
        private readonly FontFamily _pixelFontFamily;

        private const string AppUrl = "http://127.0.0.1:3000";

        public LauncherForm()
        {
            _projectRoot = ResolveProjectRoot();
            _startScript = Path.Combine(_projectRoot, "start-override-dev.bat");
            _stopScript = Path.Combine(_projectRoot, "stop-override-dev.bat");
            _pidFile = Path.Combine(_projectRoot, ".override-dev.pid");
            _fontPath = Path.Combine(_projectRoot, "tools", "override-launcher", "Tiny5-Regular.ttf");
            _iconPath = Path.Combine(_projectRoot, "tools", "override-launcher", "OverrideLauncher.ico");

            _fontCollection = new PrivateFontCollection();
            _pixelFontFamily = LoadPixelFontFamily();

            Text = "OVERRIDE QUICK LAUNCHER";
            StartPosition = FormStartPosition.CenterScreen;
            AutoScaleMode = AutoScaleMode.Dpi;
            FormBorderStyle = FormBorderStyle.Sizable;
            MaximizeBox = true;
            MinimizeBox = true;
            MinimumSize = new Size(1080, 760);
            ClientSize = new Size(1140, 780);
            BackColor = Color.FromArgb(9, 13, 20);
            ForeColor = Color.FromArgb(212, 255, 39);
            Font = CreateFont(11f, FontStyle.Regular, false);

            var icon = LoadAppIcon();
            if (icon != null)
            {
                Icon = icon;
            }

            var root = new TableLayoutPanel();
            root.Dock = DockStyle.Fill;
            root.Padding = new Padding(24, 20, 24, 24);
            root.ColumnCount = 1;
            root.RowCount = 4;
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));

            var headerPanel = new TableLayoutPanel();
            headerPanel.Dock = DockStyle.Top;
            headerPanel.AutoSize = true;
            headerPanel.ColumnCount = 1;
            headerPanel.RowCount = 2;
            headerPanel.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            headerPanel.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            headerPanel.Margin = new Padding(0, 0, 0, 18);

            var title = new Label();
            title.Text = "OVERRIDE";
            title.AutoSize = true;
            title.ForeColor = Color.FromArgb(212, 255, 39);
            title.Font = CreateFont(34f, FontStyle.Regular, true);
            title.Margin = new Padding(0, 0, 0, 6);

            var subtitle = new Label();
            subtitle.Text = "Boot launcher for local testing, browser startup, and environment setup";
            subtitle.AutoSize = true;
            subtitle.ForeColor = Color.FromArgb(191, 210, 142);
            subtitle.Font = CreateFont(12f, FontStyle.Regular, false);

            headerPanel.Controls.Add(title, 0, 0);
            headerPanel.Controls.Add(subtitle, 0, 1);

            var projectPanel = CreateSectionPanel("PROJECT ROOT");
            projectPanel.Margin = new Padding(0, 0, 0, 16);
            _projectPathValueLabel = CreateValueLabel(_projectRoot, 2);
            _projectPathValueLabel.Dock = DockStyle.Top;
            _projectPathValueLabel.Margin = new Padding(0, 2, 0, 0);
            projectPanel.Controls.Add(_projectPathValueLabel, 0, 1);

            var statusGrid = new TableLayoutPanel();
            statusGrid.Dock = DockStyle.Top;
            statusGrid.AutoSize = true;
            statusGrid.ColumnCount = 2;
            statusGrid.RowCount = 1;
            statusGrid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
            statusGrid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
            statusGrid.Margin = new Padding(0, 0, 0, 18);

            var runtimePanel = CreateSectionPanel("RUNTIME");
            runtimePanel.Margin = new Padding(0, 0, 12, 0);

            var runtimeLayout = new TableLayoutPanel();
            runtimeLayout.Dock = DockStyle.Top;
            runtimeLayout.AutoSize = true;
            runtimeLayout.ColumnCount = 2;
            runtimeLayout.RowCount = 2;
            runtimeLayout.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            runtimeLayout.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            runtimeLayout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            runtimeLayout.RowStyles.Add(new RowStyle(SizeType.AutoSize));

            runtimeLayout.Controls.Add(CreateKeyLabel("SERVER STATUS"), 0, 0);
            _serverStatusValueLabel = CreateValueLabel("UNKNOWN", 1);
            runtimeLayout.Controls.Add(_serverStatusValueLabel, 0, 1);

            runtimeLayout.Controls.Add(CreateKeyLabel("PID"), 1, 0);
            _pidValueLabel = CreateValueLabel("-", 1);
            runtimeLayout.Controls.Add(_pidValueLabel, 1, 1);

            runtimePanel.Controls.Add(runtimeLayout, 0, 1);

            var envPanel = CreateSectionPanel("ENVIRONMENT");

            var envLayout = new TableLayoutPanel();
            envLayout.Dock = DockStyle.Top;
            envLayout.AutoSize = true;
            envLayout.ColumnCount = 3;
            envLayout.RowCount = 2;
            envLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33.33f));
            envLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33.33f));
            envLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33.34f));
            envLayout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            envLayout.RowStyles.Add(new RowStyle(SizeType.AutoSize));

            envLayout.Controls.Add(CreateKeyLabel("NODE.JS"), 0, 0);
            envLayout.Controls.Add(CreateKeyLabel("NPM"), 1, 0);
            envLayout.Controls.Add(CreateKeyLabel("DEPENDENCIES"), 2, 0);

            _nodeStatusValueLabel = CreateValueLabel("CHECKING...", 1);
            _npmStatusValueLabel = CreateValueLabel("CHECKING...", 1);
            _depsStatusValueLabel = CreateValueLabel("CHECKING...", 1);

            envLayout.Controls.Add(_nodeStatusValueLabel, 0, 1);
            envLayout.Controls.Add(_npmStatusValueLabel, 1, 1);
            envLayout.Controls.Add(_depsStatusValueLabel, 2, 1);

            envPanel.Controls.Add(envLayout, 0, 1);

            statusGrid.Controls.Add(runtimePanel, 0, 0);
            statusGrid.Controls.Add(envPanel, 1, 0);

            var actionsPanel = new TableLayoutPanel();
            actionsPanel.Dock = DockStyle.Top;
            actionsPanel.AutoSize = true;
            actionsPanel.ColumnCount = 1;
            actionsPanel.RowCount = 2;
            actionsPanel.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            actionsPanel.RowStyles.Add(new RowStyle(SizeType.AutoSize));

            var primaryActions = new TableLayoutPanel();
            primaryActions.Dock = DockStyle.Top;
            primaryActions.AutoSize = true;
            primaryActions.ColumnCount = 4;
            primaryActions.RowCount = 1;
            primaryActions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25f));
            primaryActions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25f));
            primaryActions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25f));
            primaryActions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25f));
            primaryActions.Margin = new Padding(0, 0, 0, 12);

            _startButton = CreateButton("START OVERRIDE", HandleStartClick);
            _openBrowserButton = CreateButton("OPEN BROWSER", HandleOpenBrowserClick);
            _stopButton = CreateButton("STOP SERVER", HandleStopClick);
            _openFolderButton = CreateButton("OPEN FOLDER", HandleOpenFolderClick);

            primaryActions.Controls.Add(_startButton, 0, 0);
            primaryActions.Controls.Add(_openBrowserButton, 1, 0);
            primaryActions.Controls.Add(_stopButton, 2, 0);
            primaryActions.Controls.Add(_openFolderButton, 3, 0);

            var utilityActions = new TableLayoutPanel();
            utilityActions.Dock = DockStyle.Top;
            utilityActions.AutoSize = true;
            utilityActions.ColumnCount = 3;
            utilityActions.RowCount = 1;
            utilityActions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33.33f));
            utilityActions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33.33f));
            utilityActions.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33.34f));

            _checkEnvButton = CreateButton("CHECK ENV", HandleCheckEnvClick);
            _installNodeButton = CreateButton("INSTALL NODE", HandleInstallNodeClick);
            _installDepsButton = CreateButton("INSTALL DEPS", HandleInstallDepsClick);

            utilityActions.Controls.Add(_checkEnvButton, 0, 0);
            utilityActions.Controls.Add(_installNodeButton, 1, 0);
            utilityActions.Controls.Add(_installDepsButton, 2, 0);

            actionsPanel.Controls.Add(primaryActions, 0, 0);
            actionsPanel.Controls.Add(utilityActions, 0, 1);

            root.Controls.Add(headerPanel, 0, 0);
            root.Controls.Add(projectPanel, 0, 1);
            root.Controls.Add(statusGrid, 0, 2);
            root.Controls.Add(actionsPanel, 0, 3);

            Controls.Add(root);

            _statusTimer = new Timer();
            _statusTimer.Interval = 1500;
            _statusTimer.Tick += delegate { RefreshAllStatus(); };
            _statusTimer.Start();

            RefreshAllStatus();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                if (_statusTimer != null)
                {
                    _statusTimer.Dispose();
                }

                if (_fontCollection != null)
                {
                    _fontCollection.Dispose();
                }
            }

            base.Dispose(disposing);
        }

        private FontFamily LoadPixelFontFamily()
        {
            try
            {
                if (File.Exists(_fontPath))
                {
                    _fontCollection.AddFontFile(_fontPath);
                    if (_fontCollection.Families.Length > 0)
                    {
                        return _fontCollection.Families[0];
                    }
                }
            }
            catch
            {
            }

            return FontFamily.GenericMonospace;
        }

        private Font CreateFont(float size, FontStyle style, bool largeTitle)
        {
            var actualSize = largeTitle ? size : size;
            return new Font(_pixelFontFamily, actualSize, style, GraphicsUnit.Point);
        }

        private Icon LoadAppIcon()
        {
            try
            {
                if (File.Exists(_iconPath))
                {
                    return new Icon(_iconPath);
                }

                return Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch
            {
                return null;
            }
        }

        private TableLayoutPanel CreateSectionPanel(string title)
        {
            var panel = new TableLayoutPanel();
            panel.Dock = DockStyle.Top;
            panel.AutoSize = true;
            panel.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            panel.Padding = new Padding(16, 14, 16, 14);
            panel.BackColor = Color.FromArgb(12, 18, 28);
            panel.ColumnCount = 1;
            panel.RowCount = 2;
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            panel.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            panel.RowStyles.Add(new RowStyle(SizeType.AutoSize));

            var titleLabel = new Label();
            titleLabel.Text = title;
            titleLabel.AutoSize = true;
            titleLabel.ForeColor = Color.FromArgb(188, 206, 140);
            titleLabel.Font = CreateFont(11f, FontStyle.Regular, false);
            titleLabel.Margin = new Padding(0, 0, 0, 10);
            titleLabel.Dock = DockStyle.Top;

            panel.Controls.Add(titleLabel, 0, 0);
            return panel;
        }

        private Label CreateKeyLabel(string text)
        {
            var label = new Label();
            label.Text = text;
            label.AutoSize = true;
            label.ForeColor = Color.FromArgb(188, 206, 140);
            label.Font = CreateFont(10f, FontStyle.Regular, false);
            label.Margin = new Padding(0, 2, 18, 6);
            return label;
        }

        private Label CreateValueLabel(string text, int lines)
        {
            var label = new Label();
            label.Text = text;
            label.AutoSize = false;
            label.AutoEllipsis = true;
            label.MaximumSize = new Size(0, 0);
            label.MinimumSize = new Size(0, Math.Max(28, lines * 24));
            label.Dock = DockStyle.Top;
            label.ForeColor = Color.FromArgb(236, 244, 200);
            label.Font = CreateFont(12f, FontStyle.Regular, false);
            label.Margin = new Padding(0, 0, 0, 0);
            return label;
        }

        private Button CreateButton(string text, EventHandler onClick)
        {
            var button = new Button();
            button.Text = text;
            button.Dock = DockStyle.Fill;
            button.MinimumSize = new Size(220, 52);
            button.Height = 52;
            button.Margin = new Padding(0, 0, 12, 12);
            button.FlatStyle = FlatStyle.Flat;
            button.BackColor = Color.FromArgb(14, 20, 31);
            button.ForeColor = Color.FromArgb(212, 255, 39);
            button.Cursor = Cursors.Hand;
            button.Font = CreateFont(12f, FontStyle.Regular, false);
            button.FlatAppearance.BorderColor = Color.FromArgb(118, 142, 48);
            button.FlatAppearance.MouseDownBackColor = Color.FromArgb(22, 30, 42);
            button.FlatAppearance.MouseOverBackColor = Color.FromArgb(19, 28, 40);
            button.Click += onClick;
            return button;
        }

        private static string ResolveProjectRoot()
        {
            var current = new DirectoryInfo(Application.StartupPath);
            while (current != null)
            {
                var packageJson = Path.Combine(current.FullName, "package.json");
                var startScript = Path.Combine(current.FullName, "start-override-dev.bat");
                if (File.Exists(packageJson) && File.Exists(startScript))
                {
                    return current.FullName;
                }

                current = current.Parent;
            }

            throw new DirectoryNotFoundException("Could not locate the override project root.");
        }

        private void RefreshAllStatus()
        {
            RefreshServerStatus();
            RefreshEnvironmentStatus();
        }

        private void RefreshServerStatus()
        {
            int pid;
            var running = TryGetRunningPid(out pid);
            _serverStatusValueLabel.Text = running ? "RUNNING" : "STOPPED";
            _serverStatusValueLabel.ForeColor = running ? Color.FromArgb(212, 255, 39) : Color.FromArgb(245, 201, 77);
            _pidValueLabel.Text = running ? pid.ToString() : "-";
        }

        private void RefreshEnvironmentStatus()
        {
            string nodeVersion;
            var nodeOk = TryRunCommand("cmd.exe", "/c node -v", out nodeVersion);
            string npmVersion;
            var npmOk = TryRunCommand("cmd.exe", "/c npm -v", out npmVersion);
            var depsOk = Directory.Exists(Path.Combine(_projectRoot, "node_modules"));

            _nodeStatusValueLabel.Text = nodeOk ? TrimLine(nodeVersion) : "MISSING";
            _nodeStatusValueLabel.ForeColor = nodeOk ? Color.FromArgb(212, 255, 39) : Color.FromArgb(245, 201, 77);

            _npmStatusValueLabel.Text = npmOk ? TrimLine(npmVersion) : "MISSING";
            _npmStatusValueLabel.ForeColor = npmOk ? Color.FromArgb(212, 255, 39) : Color.FromArgb(245, 201, 77);

            _depsStatusValueLabel.Text = depsOk ? "INSTALLED" : "MISSING";
            _depsStatusValueLabel.ForeColor = depsOk ? Color.FromArgb(212, 255, 39) : Color.FromArgb(245, 201, 77);
        }

        private static string TrimLine(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? "-" : value.Trim();
        }

        private bool TryGetRunningPid(out int pid)
        {
            pid = 0;
            if (!File.Exists(_pidFile))
            {
                return false;
            }

            var text = File.ReadAllText(_pidFile, Encoding.UTF8).Trim();
            if (!int.TryParse(text, out pid))
            {
                pid = 0;
                return false;
            }

            try
            {
                var process = Process.GetProcessById(pid);
                if (process.HasExited)
                {
                    pid = 0;
                    return false;
                }

                return true;
            }
            catch
            {
                pid = 0;
                return false;
            }
        }

        private static bool TryRunCommand(string fileName, string arguments, out string output)
        {
            output = string.Empty;
            try
            {
                var startInfo = new ProcessStartInfo();
                startInfo.FileName = fileName;
                startInfo.Arguments = arguments;
                startInfo.UseShellExecute = false;
                startInfo.CreateNoWindow = true;
                startInfo.RedirectStandardOutput = true;
                startInfo.RedirectStandardError = true;

                using (var process = Process.Start(startInfo))
                {
                    if (process == null)
                    {
                        return false;
                    }

                    output = process.StandardOutput.ReadToEnd();
                    var error = process.StandardError.ReadToEnd();
                    process.WaitForExit();

                    if (process.ExitCode != 0)
                    {
                        output = string.IsNullOrWhiteSpace(error) ? output : error;
                        return false;
                    }

                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        private void HandleStartClick(object sender, EventArgs e)
        {
            RunScript(_startScript);
            RefreshAllStatus();
        }

        private void HandleStopClick(object sender, EventArgs e)
        {
            RunScript(_stopScript);
            RefreshAllStatus();
        }

        private void HandleOpenBrowserClick(object sender, EventArgs e)
        {
            Process.Start(AppUrl);
        }

        private void HandleOpenFolderClick(object sender, EventArgs e)
        {
            Process.Start("explorer.exe", _projectRoot);
        }

        private void HandleCheckEnvClick(object sender, EventArgs e)
        {
            RefreshAllStatus();
            MessageBox.Show(
                "Environment status has been refreshed.",
                "Override Launcher",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information
            );
        }

        private void HandleInstallNodeClick(object sender, EventArgs e)
        {
            string output;
            if (TryRunCommand("cmd.exe", "/c node -v", out output))
            {
                MessageBox.Show(
                    "Node.js is already installed: " + TrimLine(output),
                    "Override Launcher",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
                return;
            }

            string wingetOutput;
            if (TryRunCommand("cmd.exe", "/c where winget", out wingetOutput))
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = "/k winget install OpenJS.NodeJS.LTS",
                    UseShellExecute = true
                });
                return;
            }

            MessageBox.Show(
                "winget was not found on this machine. The official Node.js download page will open instead.",
                "Override Launcher",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information
            );
            Process.Start("https://nodejs.org/en/download");
        }

        private void HandleInstallDepsClick(object sender, EventArgs e)
        {
            string output;
            if (!TryRunCommand("cmd.exe", "/c npm -v", out output))
            {
                MessageBox.Show(
                    "npm was not found. Please install Node.js first.",
                    "Override Launcher",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
                return;
            }

            Process.Start(new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = "/k cd /d \"" + _projectRoot + "\" && npm install",
                UseShellExecute = true,
                WorkingDirectory = _projectRoot
            });
        }

        private void RunScript(string scriptPath)
        {
            if (!File.Exists(scriptPath))
            {
                MessageBox.Show(
                    "Script not found:\n" + scriptPath,
                    "Override Launcher",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            var startInfo = new ProcessStartInfo();
            startInfo.FileName = scriptPath;
            startInfo.WorkingDirectory = _projectRoot;
            startInfo.UseShellExecute = true;

            Process.Start(startInfo);
        }
    }
}
