using System.Diagnostics;
using System.Text;
using System.Windows.Forms;

namespace OverrideLauncher;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new LauncherForm());
    }
}

internal sealed class LauncherForm : Form
{
    private readonly Label _projectPathLabel;
    private readonly Label _statusValueLabel;
    private readonly Label _pidValueLabel;
    private readonly Button _startButton;
    private readonly Button _openBrowserButton;
    private readonly Button _stopButton;
    private readonly Button _openFolderButton;
    private readonly Timer _statusTimer;

    private readonly string _projectRoot;
    private readonly string _startScript;
    private readonly string _stopScript;
    private readonly string _pidFile;
    private const string AppUrl = "http://127.0.0.1:3000";

    public LauncherForm()
    {
        _projectRoot = ResolveProjectRoot();
        _startScript = Path.Combine(_projectRoot, "start-override-dev.bat");
        _stopScript = Path.Combine(_projectRoot, "stop-override-dev.bat");
        _pidFile = Path.Combine(_projectRoot, ".override-dev.pid");

        Text = "OVERRIDE QUICK LAUNCHER";
        Width = 520;
        Height = 320;
        MaximizeBox = false;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(10, 14, 22);
        ForeColor = Color.FromArgb(212, 255, 39);
        Font = new Font("Consolas", 10f, FontStyle.Regular, GraphicsUnit.Point);

        var title = new Label
        {
            Text = "OVERRIDE",
            Font = new Font("Consolas", 26f, FontStyle.Bold, GraphicsUnit.Point),
            ForeColor = Color.FromArgb(212, 255, 39),
            AutoSize = true,
            Location = new Point(20, 18)
        };

        var subtitle = new Label
        {
            Text = "Quick launcher for local testing and browser startup",
            AutoSize = true,
            ForeColor = Color.FromArgb(188, 206, 140),
            Location = new Point(24, 66)
        };

        var projectLabel = new Label
        {
            Text = "PROJECT ROOT",
            AutoSize = true,
            ForeColor = Color.FromArgb(188, 206, 140),
            Location = new Point(24, 102)
        };

        _projectPathLabel = new Label
        {
            Text = _projectRoot,
            AutoSize = false,
            Width = 450,
            Height = 42,
            ForeColor = Color.FromArgb(236, 244, 200),
            Location = new Point(24, 124)
        };

        var statusLabel = new Label
        {
            Text = "SERVER STATUS",
            AutoSize = true,
            ForeColor = Color.FromArgb(188, 206, 140),
            Location = new Point(24, 176)
        };

        _statusValueLabel = new Label
        {
            Text = "UNKNOWN",
            AutoSize = true,
            ForeColor = Color.FromArgb(236, 244, 200),
            Location = new Point(24, 198)
        };

        var pidLabel = new Label
        {
            Text = "PID",
            AutoSize = true,
            ForeColor = Color.FromArgb(188, 206, 140),
            Location = new Point(214, 176)
        };

        _pidValueLabel = new Label
        {
            Text = "-",
            AutoSize = true,
            ForeColor = Color.FromArgb(236, 244, 200),
            Location = new Point(214, 198)
        };

        _startButton = CreateButton("START OVERRIDE", new Point(24, 236), HandleStartClick);
        _openBrowserButton = CreateButton("OPEN BROWSER", new Point(170, 236), HandleOpenBrowserClick);
        _stopButton = CreateButton("STOP SERVER", new Point(316, 236), HandleStopClick);
        _openFolderButton = CreateButton("OPEN FOLDER", new Point(24, 272), HandleOpenFolderClick);

        Controls.Add(title);
        Controls.Add(subtitle);
        Controls.Add(projectLabel);
        Controls.Add(_projectPathLabel);
        Controls.Add(statusLabel);
        Controls.Add(_statusValueLabel);
        Controls.Add(pidLabel);
        Controls.Add(_pidValueLabel);
        Controls.Add(_startButton);
        Controls.Add(_openBrowserButton);
        Controls.Add(_stopButton);
        Controls.Add(_openFolderButton);

        _statusTimer = new Timer { Interval = 1500 };
        _statusTimer.Tick += (_, _) => RefreshServerStatus();
        _statusTimer.Start();

        RefreshServerStatus();
    }

    private Button CreateButton(string text, Point location, EventHandler onClick)
    {
        var button = new Button
        {
            Text = text,
            Width = 132,
            Height = 30,
            Location = location,
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(14, 20, 31),
            ForeColor = Color.FromArgb(212, 255, 39),
            Cursor = Cursors.Hand
        };
        button.FlatAppearance.BorderColor = Color.FromArgb(118, 142, 48);
        button.FlatAppearance.MouseDownBackColor = Color.FromArgb(22, 30, 42);
        button.FlatAppearance.MouseOverBackColor = Color.FromArgb(19, 28, 40);
        button.Click += onClick;
        return button;
    }

    private static string ResolveProjectRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
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

    private void RefreshServerStatus()
    {
        var (running, pid) = TryGetRunningPid();
        _statusValueLabel.Text = running ? "RUNNING" : "STOPPED";
        _statusValueLabel.ForeColor = running ? Color.FromArgb(212, 255, 39) : Color.FromArgb(245, 201, 77);
        _pidValueLabel.Text = running ? pid.ToString() : "-";
    }

    private (bool Running, int Pid) TryGetRunningPid()
    {
        if (!File.Exists(_pidFile))
        {
            return (false, 0);
        }

        var text = File.ReadAllText(_pidFile, Encoding.UTF8).Trim();
        if (!int.TryParse(text, out var pid))
        {
            return (false, 0);
        }

        try
        {
            var process = Process.GetProcessById(pid);
            if (process.HasExited)
            {
                return (false, 0);
            }

            return (true, pid);
        }
        catch
        {
            return (false, 0);
        }
    }

    private void HandleStartClick(object? sender, EventArgs e)
    {
        RunScript(_startScript);
        RefreshServerStatus();
    }

    private void HandleStopClick(object? sender, EventArgs e)
    {
        RunScript(_stopScript);
        RefreshServerStatus();
    }

    private void HandleOpenBrowserClick(object? sender, EventArgs e)
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = AppUrl,
            UseShellExecute = true
        });
    }

    private void HandleOpenFolderClick(object? sender, EventArgs e)
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = _projectRoot,
            UseShellExecute = true
        });
    }

    private void RunScript(string scriptPath)
    {
        if (!File.Exists(scriptPath))
        {
            MessageBox.Show(
                $"Script not found:\n{scriptPath}",
                "Override Launcher",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            return;
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = scriptPath,
            UseShellExecute = true,
            WorkingDirectory = _projectRoot
        });
    }
}
